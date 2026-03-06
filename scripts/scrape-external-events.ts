/**
 * External event scraper.
 *
 * Scrapes external sources (newsletters, event pages) and populates the events
 * table with isExternal=true entries. Designed to run as a GitHub Actions
 * scheduled workflow or locally via:
 *
 *   npx tsx scripts/scrape-external-events.ts
 *
 * Requires:
 *   - DATABASE_URL env var pointing to PostgreSQL
 *   - ANTHROPIC_API_KEY env var for LLM extraction
 *   - Playwright Chromium installed: npx playwright install chromium --with-deps
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { chromium } from "playwright";
import { db, pool } from "../src/db/index";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { SCRAPE_SOURCES, type ScrapeSource } from "./sources";
import type { EventCategory } from "../src/types";

// ── Types ───────────────────────────────────────────────────────────

interface ExtractedEvent {
  name: string;
  startDate: string; // ISO-8601 or "YYYY-MM-DD"
  endDate: string | null;
  city: string;
  country: string;
  bookingUrl: string | null;
  posterUrl: string | null;
  category: string | null;
  description: string | null;
}

interface ScraperResult {
  sourceId: string;
  eventsAdded: number;
  eventsSkipped: number;
  errors: string[];
}

// ── Nominatim geocoding ─────────────────────────────────────────────

async function geocode(
  city: string,
  country: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const query = encodeURIComponent(`${city}, ${country}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AcroCommunityEventScraper/1.0" },
    });
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (data.length > 0) {
      return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.warn(`  Geocode failed for "${city}, ${country}":`, err);
  }
  return null;
}

// ── LLM extraction ──────────────────────────────────────────────────

async function extractEventsWithLLM(text: string): Promise<ExtractedEvent[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");

  const prompt = `Extract all AcroYoga / acrobatics / movement events from this newsletter text.

For each event, return a JSON object with these fields:
- name: string (event name)
- startDate: string (ISO-8601 date, e.g. "2026-03-15")
- endDate: string | null (ISO-8601 date, null if single-day)
- city: string (city name)
- country: string (country name)
- bookingUrl: string | null (URL to book or get more info)
- posterUrl: string | null (image URL if visible)
- category: "festival" | "workshop" | "class" | "jam" | null
- description: string | null (brief 1-2 sentence description)

Return ONLY a valid JSON array. If no events are found, return [].
Do not include any text outside the JSON array.

Newsletter text:
${text.slice(0, 30000)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-20250414",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const body = (await res.json()) as {
    content: { type: string; text: string }[];
  };
  const responseText = body.content.find((c) => c.type === "text")?.text ?? "[]";

  // Extract JSON array from response (handle markdown code blocks)
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]) as ExtractedEvent[];
  } catch {
    console.warn("  Failed to parse LLM response as JSON");
    return [];
  }
}

// ── Location find-or-create ─────────────────────────────────────────

async function findOrCreateLocation(
  city: string,
  country: string,
): Promise<string | null> {
  // Try to find an existing location in this city/country
  const existing = await db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(
      and(
        eq(schema.locations.city, city),
        eq(schema.locations.country, country),
      ),
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  // Geocode and create a new location
  const coords = await geocode(city, country);
  if (!coords) {
    console.warn(`  Could not geocode "${city}, ${country}" — skipping`);
    return null;
  }

  const id = `loc-${crypto.randomUUID()}`;
  await db.insert(schema.locations).values({
    id,
    name: `${city} (auto)`,
    city,
    country,
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
  console.log(`  Created location: ${city}, ${country} (${id})`);

  // Rate-limit Nominatim (1 req/sec policy)
  await new Promise((r) => setTimeout(r, 1100));
  return id;
}

// ── Duplicate check ─────────────────────────────────────────────────

async function isDuplicate(title: string, dateTime: string, locationId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.title, title),
        eq(schema.events.dateTime, dateTime),
        eq(schema.events.locationId, locationId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ── Beehiiv newsletter scraper ──────────────────────────────────────

async function scrapeBeehiivNewsletter(source: ScrapeSource): Promise<ScraperResult> {
  const result: ScraperResult = { sourceId: source.id, eventsAdded: 0, eventsSkipped: 0, errors: [] };

  // Check last scrape run
  const [lastRun] = await db
    .select()
    .from(schema.scraperRuns)
    .where(eq(schema.scraperRuns.sourceId, source.id))
    .limit(1);

  console.log(`\nScraping: ${source.name} (${source.archiveUrl})`);
  if (lastRun) {
    console.log(`  Last run: ${lastRun.lastRunAt}, added: ${lastRun.eventsAdded}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "AcroCommunityEventScraper/1.0",
  });

  try {
    // 1. Fetch the archive page
    const page = await context.newPage();
    await page.goto(source.archiveUrl, { waitUntil: "networkidle", timeout: 30000 });

    // 2. Collect post links
    const postLinks = await page.evaluate(() => {
      const links: { url: string; title: string; date: string }[] = [];
      // Beehiiv archive pages typically have article/post links
      const anchors = document.querySelectorAll("a[href*='/p/']");
      anchors.forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        const text = a.textContent?.trim() ?? "";
        // Try to find a date nearby
        const parent = a.closest("article, div, li");
        const dateEl = parent?.querySelector("time, [datetime]");
        const dateStr =
          dateEl?.getAttribute("datetime") ?? dateEl?.textContent?.trim() ?? "";
        if (href && text) {
          links.push({ url: href, title: text, date: dateStr });
        }
      });
      return links;
    });

    // Deduplicate by URL
    const uniqueLinks = [...new Map(postLinks.map((l) => [l.url, l])).values()];
    console.log(`  Found ${uniqueLinks.length} newsletter posts`);

    // 3. Filter to posts not yet scraped
    const postsToScrape = lastRun?.lastScrapedUrl
      ? uniqueLinks.filter((l) => {
          // Process posts until we hit the last scraped URL
          return l.url !== lastRun.lastScrapedUrl;
        })
      : uniqueLinks.slice(0, 3); // On first run, only process the 3 most recent

    if (postsToScrape.length === 0) {
      console.log("  No new posts to scrape");
      await browser.close();
      return result;
    }

    console.log(`  Processing ${postsToScrape.length} new posts`);

    // 4. For each post, extract text and parse events
    for (const post of postsToScrape) {
      console.log(`\n  Reading: ${post.title}`);
      try {
        await page.goto(post.url, { waitUntil: "networkidle", timeout: 30000 });

        // Extract the main content text
        const textContent = await page.evaluate(() => {
          // Try common newsletter content selectors
          const article =
            document.querySelector("article") ??
            document.querySelector('[class*="post"]') ??
            document.querySelector("main") ??
            document.body;
          return article.innerText;
        });

        if (!textContent || textContent.length < 100) {
          console.log("    Skipped — insufficient content");
          continue;
        }

        // 5. LLM extraction
        console.log(`    Extracted ${textContent.length} chars, sending to LLM...`);
        const events = await extractEventsWithLLM(textContent);
        console.log(`    LLM found ${events.length} events`);

        // 6. Process each extracted event
        for (const evt of events) {
          try {
            // Validate minimum fields
            if (!evt.name || !evt.startDate || !evt.city || !evt.country) {
              result.eventsSkipped++;
              continue;
            }

            // Normalise dates
            const startDate = evt.startDate.includes("T")
              ? evt.startDate
              : `${evt.startDate}T10:00:00Z`;
            const endDate = evt.endDate
              ? evt.endDate.includes("T")
                ? evt.endDate
                : `${evt.endDate}T18:00:00Z`
              : startDate.replace("10:00:00Z", "18:00:00Z");

            // Find or create location
            const locationId = await findOrCreateLocation(evt.city, evt.country);
            if (!locationId) {
              result.eventsSkipped++;
              continue;
            }

            // Duplicate check
            if (await isDuplicate(evt.name, startDate, locationId)) {
              result.eventsSkipped++;
              continue;
            }

            // Map category
            const validCategories = ["festival", "workshop", "class", "jam"];
            const category: EventCategory = validCategories.includes(evt.category ?? "")
              ? (evt.category as EventCategory)
              : source.defaultCategory;

            // Insert event
            const id = `evt-${crypto.randomUUID()}`;
            const now = new Date().toISOString();
            await db.insert(schema.events).values({
              id,
              title: evt.name,
              description: evt.description ?? `External event from ${source.name}`,
              dateTime: startDate,
              endDateTime: endDate,
              locationId,
              status: "pending", // Admin review before publishing
              createdBy: null,
              dateAdded: now,
              lastUpdated: now,
              eventCategory: category,
              isExternal: true,
              externalUrl: evt.bookingUrl,
              posterUrl: evt.posterUrl,
            });

            result.eventsAdded++;
            console.log(`    + ${evt.name} (${evt.city}, ${evt.country})`);
          } catch (err) {
            const msg = `Failed to process event "${evt.name}": ${err}`;
            console.warn(`    ${msg}`);
            result.errors.push(msg);
            result.eventsSkipped++;
          }
        }
      } catch (err) {
        const msg = `Failed to scrape post "${post.title}": ${err}`;
        console.warn(`    ${msg}`);
        result.errors.push(msg);
      }
    }

    // 7. Record this scrape run
    const runId = `run-${crypto.randomUUID()}`;
    const newestUrl = postsToScrape[0]?.url ?? lastRun?.lastScrapedUrl ?? null;

    if (lastRun) {
      await db
        .update(schema.scraperRuns)
        .set({
          lastScrapedUrl: newestUrl,
          lastRunAt: new Date().toISOString(),
          eventsAdded: result.eventsAdded,
          eventsSkipped: result.eventsSkipped,
        })
        .where(eq(schema.scraperRuns.id, lastRun.id));
    } else {
      await db.insert(schema.scraperRuns).values({
        id: runId,
        sourceId: source.id,
        lastScrapedUrl: newestUrl,
        lastRunAt: new Date().toISOString(),
        eventsAdded: result.eventsAdded,
        eventsSkipped: result.eventsSkipped,
      });
    }
  } finally {
    await browser.close();
  }

  return result;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("=== External Event Scraper ===");
  console.log(`Sources: ${SCRAPE_SOURCES.length}`);
  console.log(`Database: ${process.env.DATABASE_URL ? "configured" : "MISSING"}\n`);

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const results: ScraperResult[] = [];

  for (const source of SCRAPE_SOURCES) {
    try {
      let result: ScraperResult;
      switch (source.type) {
        case "beehiiv-newsletter":
          result = await scrapeBeehiivNewsletter(source);
          break;
        default:
          console.warn(`Unsupported source type: ${source.type}`);
          continue;
      }
      results.push(result);
    } catch (err) {
      console.error(`Failed to scrape ${source.name}:`, err);
      results.push({
        sourceId: source.id,
        eventsAdded: 0,
        eventsSkipped: 0,
        errors: [String(err)],
      });
    }
  }

  // Summary
  console.log("\n=== Scraper Summary ===");
  for (const r of results) {
    console.log(`  ${r.sourceId}: +${r.eventsAdded} added, ${r.eventsSkipped} skipped, ${r.errors.length} errors`);
  }

  const totalAdded = results.reduce((s, r) => s + r.eventsAdded, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  console.log(`\nTotal: ${totalAdded} events added, ${totalErrors} errors`);

  await pool.end();

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});

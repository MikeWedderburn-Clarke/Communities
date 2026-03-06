/**
 * External event scraper — two-phase local workflow.
 *
 * Usage:
 *
 *   ## Phase 1: Scrape newsletter text (no API key needed)
 *   npx tsx scripts/scrape-external-events.ts scrape
 *   # → writes text files + prompt to scripts/scraped/<source-id>/
 *
 *   ## Phase 2: Import events from JSON (after you use Copilot/ChatGPT to extract)
 *   npx tsx scripts/scrape-external-events.ts import
 *   # → reads scripts/scraped/<source-id>/events.json, geocodes, inserts into DB
 *
 *   ## Full auto mode (requires ANTHROPIC_API_KEY)
 *   npx tsx scripts/scrape-external-events.ts auto
 *
 * Requires:
 *   - DATABASE_URL env var (for import/auto modes)
 *   - Playwright Chromium: npx playwright install chromium --with-deps
 *   - ANTHROPIC_API_KEY env var (only for auto mode)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
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

// ── Extraction prompt (shared between modes) ────────────────────────

const EXTRACTION_PROMPT = `Extract all AcroYoga / acrobatics / movement events from this newsletter text.

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
Do not include any text outside the JSON array.`;

// ── Scraped content directory ───────────────────────────────────────

const SCRAPED_DIR = path.join(__dirname, "scraped");

function ensureScrapedDir(sourceId: string): string {
  const dir = path.join(SCRAPED_DIR, sourceId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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

// ── LLM extraction (auto mode only) ────────────────────────────────

async function extractEventsWithLLM(text: string): Promise<ExtractedEvent[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for auto mode");

  const prompt = `${EXTRACTION_PROMPT}\n\nNewsletter text:\n${text.slice(0, 30000)}`;

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

  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]) as ExtractedEvent[];
  } catch {
    console.warn("  Failed to parse LLM response as JSON");
    return [];
  }
}

// ── Playwright scraping (shared between scrape & auto) ──────────────

interface ScrapedPost {
  url: string;
  title: string;
  date: string;
  textContent: string;
}

async function scrapeBeehiivPosts(source: ScrapeSource, maxPosts = 3): Promise<ScrapedPost[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "AcroCommunityEventScraper/1.0",
  });

  const posts: ScrapedPost[] = [];

  try {
    const page = await context.newPage();
    console.log(`\nScraping: ${source.name} (${source.archiveUrl})`);
    await page.goto(source.archiveUrl, { waitUntil: "networkidle", timeout: 30000 });

    // Collect post links
    const postLinks = await page.evaluate(() => {
      const links: { url: string; title: string; date: string }[] = [];
      const anchors = document.querySelectorAll("a[href*='/p/']");
      anchors.forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        const text = a.textContent?.trim() ?? "";
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

    const uniqueLinks = [...new Map(postLinks.map((l) => [l.url, l])).values()];
    console.log(`  Found ${uniqueLinks.length} newsletter posts`);

    const toProcess = uniqueLinks.slice(0, maxPosts);
    console.log(`  Processing ${toProcess.length} posts`);

    for (const post of toProcess) {
      console.log(`  Reading: ${post.title}`);
      try {
        await page.goto(post.url, { waitUntil: "networkidle", timeout: 30000 });

        const textContent = await page.evaluate(() => {
          const article =
            document.querySelector("article") ??
            document.querySelector('[class*="post"]') ??
            document.querySelector("main") ??
            document.body;
          return article.innerText;
        });

        if (!textContent || textContent.length < 100) {
          console.log(`    Skipped — insufficient content`);
          continue;
        }

        console.log(`    Extracted ${textContent.length} chars`);
        posts.push({ url: post.url, title: post.title, date: post.date, textContent });
      } catch (err) {
        console.warn(`    Failed to read post: ${err}`);
      }
    }
  } finally {
    await browser.close();
  }

  return posts;
}

// ── Phase 1: scrape (save text for manual LLM extraction) ───────────

async function runScrape() {
  console.log("=== Phase 1: Scrape Newsletter Text ===\n");

  for (const source of SCRAPE_SOURCES) {
    if (source.type !== "beehiiv-newsletter") {
      console.warn(`Unsupported source type: ${source.type} — skipping`);
      continue;
    }

    const posts = await scrapeBeehiivPosts(source);
    if (posts.length === 0) {
      console.log("  No posts scraped.");
      continue;
    }

    const dir = ensureScrapedDir(source.id);

    // Save each post's text
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const slug = post.url.split("/p/")[1]?.replace(/[^a-z0-9-]/gi, "_") ?? `post-${i}`;
      const textFile = path.join(dir, `${slug}.txt`);
      fs.writeFileSync(textFile, post.textContent, "utf-8");
      console.log(`  Saved: ${textFile}`);
    }

    // Save the extraction prompt
    const promptFile = path.join(dir, "PROMPT.md");
    fs.writeFileSync(
      promptFile,
      `# Event Extraction Prompt\n\nPaste the contents of each .txt file into GitHub Copilot Chat (or any LLM) together with this prompt. Save the resulting JSON array to \`events.json\` in this directory, then run:\n\n\`\`\`\nnpx tsx scripts/scrape-external-events.ts import\n\`\`\`\n\n---\n\n${EXTRACTION_PROMPT}\n\nNewsletter text:\n<paste the .txt file contents here>\n`,
      "utf-8",
    );

    // Save metadata
    const metaFile = path.join(dir, "meta.json");
    fs.writeFileSync(
      metaFile,
      JSON.stringify(
        {
          sourceId: source.id,
          sourceName: source.name,
          scrapedAt: new Date().toISOString(),
          posts: posts.map((p) => ({ url: p.url, title: p.title, date: p.date })),
        },
        null,
        2,
      ),
      "utf-8",
    );

    console.log(`\n  Prompt saved to: ${promptFile}`);
    console.log(`  Metadata saved to: ${metaFile}`);
    console.log(`\n  Next steps:`);
    console.log(`    1. Open each .txt file in ${dir}`);
    console.log(`    2. Paste contents into Copilot Chat with the prompt from PROMPT.md`);
    console.log(`    3. Save the JSON array output to ${path.join(dir, "events.json")}`);
    console.log(`    4. Run: npx tsx scripts/scrape-external-events.ts import`);
  }
}

// ── Phase 2: import (read events.json, geocode, insert into DB) ─────

async function runImport() {
  const { db, pool } = await import("../src/db/index");
  const schema = await import("../src/db/schema");

  console.log("=== Phase 2: Import Events from JSON ===\n");

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  let totalAdded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const source of SCRAPE_SOURCES) {
    const dir = path.join(SCRAPED_DIR, source.id);
    const eventsFile = path.join(dir, "events.json");

    if (!fs.existsSync(eventsFile)) {
      console.log(`  No events.json found for ${source.id} — skipping`);
      console.log(`  (Expected at: ${eventsFile})`);
      continue;
    }

    console.log(`Importing events for: ${source.name}`);

    let events: ExtractedEvent[];
    try {
      const raw = fs.readFileSync(eventsFile, "utf-8");
      events = JSON.parse(raw) as ExtractedEvent[];
    } catch (err) {
      console.error(`  Failed to parse ${eventsFile}: ${err}`);
      totalErrors++;
      continue;
    }

    console.log(`  Found ${events.length} events in JSON`);

    for (const evt of events) {
      try {
        if (!evt.name || !evt.startDate || !evt.city || !evt.country) {
          console.warn(`  Skipped — missing required fields: ${evt.name ?? "(no name)"}`);
          totalSkipped++;
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
        const locationId = await findOrCreateLocationDb(db, schema, evt.city, evt.country);
        if (!locationId) {
          totalSkipped++;
          continue;
        }

        // Duplicate check
        if (await isDuplicateDb(db, schema, evt.name, startDate, locationId)) {
          console.log(`  Skipped duplicate: ${evt.name}`);
          totalSkipped++;
          continue;
        }

        // Map category
        const validCategories = ["festival", "workshop", "class", "jam"];
        const category: EventCategory = validCategories.includes(evt.category ?? "")
          ? (evt.category as EventCategory)
          : source.defaultCategory;

        const id = `evt-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        await db.insert(schema.events).values({
          id,
          title: evt.name,
          description: evt.description ?? `External event from ${source.name}`,
          dateTime: startDate,
          endDateTime: endDate,
          locationId,
          status: "pending",
          createdBy: null,
          dateAdded: now,
          lastUpdated: now,
          eventCategory: category,
          isExternal: true,
          externalUrl: evt.bookingUrl,
          posterUrl: evt.posterUrl,
        });

        totalAdded++;
        console.log(`  + ${evt.name} (${evt.city}, ${evt.country})`);
      } catch (err) {
        console.warn(`  Failed: ${evt.name}: ${err}`);
        totalErrors++;
      }
    }
  }

  console.log(`\n=== Import Summary ===`);
  console.log(`  Added: ${totalAdded}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);

  await pool.end();

  if (totalErrors > 0) process.exit(1);
}

// DB helpers for import mode (use dynamic imports to avoid requiring DB connection for scrape mode)

async function findOrCreateLocationDb(
  db: any,
  schema: any,
  city: string,
  country: string,
): Promise<string | null> {
  const { eq, and } = await import("drizzle-orm");

  const existing = await db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(and(eq(schema.locations.city, city), eq(schema.locations.country, country)))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

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

async function isDuplicateDb(
  db: any,
  schema: any,
  title: string,
  dateTime: string,
  locationId: string,
): Promise<boolean> {
  const { eq, and } = await import("drizzle-orm");
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

// ── Full auto mode (scrape + LLM + import in one shot) ──────────────

async function runAuto() {
  const { db, pool } = await import("../src/db/index");
  const schema = await import("../src/db/schema");
  const { eq, and } = await import("drizzle-orm");

  console.log("=== Auto Mode: Scrape + LLM Extract + Import ===\n");

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY is required for auto mode");
    console.error("Tip: Use 'scrape' + 'import' modes to avoid needing an API key");
    process.exit(1);
  }

  const results: ScraperResult[] = [];

  for (const source of SCRAPE_SOURCES) {
    if (source.type !== "beehiiv-newsletter") {
      console.warn(`Unsupported source type: ${source.type}`);
      continue;
    }

    const result: ScraperResult = { sourceId: source.id, eventsAdded: 0, eventsSkipped: 0, errors: [] };

    // Check last scrape run
    const [lastRun] = await db
      .select()
      .from(schema.scraperRuns)
      .where(eq(schema.scraperRuns.sourceId, source.id))
      .limit(1);

    if (lastRun) {
      console.log(`Last run: ${lastRun.lastRunAt}, added: ${lastRun.eventsAdded}`);
    }

    const posts = await scrapeBeehiivPosts(source);

    for (const post of posts) {
      try {
        console.log(`  Sending to LLM: ${post.title}`);
        const events = await extractEventsWithLLM(post.textContent);
        console.log(`  LLM found ${events.length} events`);

        for (const evt of events) {
          try {
            if (!evt.name || !evt.startDate || !evt.city || !evt.country) {
              result.eventsSkipped++;
              continue;
            }

            const startDate = evt.startDate.includes("T")
              ? evt.startDate
              : `${evt.startDate}T10:00:00Z`;
            const endDate = evt.endDate
              ? evt.endDate.includes("T")
                ? evt.endDate
                : `${evt.endDate}T18:00:00Z`
              : startDate.replace("10:00:00Z", "18:00:00Z");

            const locationId = await findOrCreateLocationDb(db, schema, evt.city, evt.country);
            if (!locationId) { result.eventsSkipped++; continue; }

            if (await isDuplicateDb(db, schema, evt.name, startDate, locationId)) {
              result.eventsSkipped++;
              continue;
            }

            const validCategories = ["festival", "workshop", "class", "jam"];
            const category: EventCategory = validCategories.includes(evt.category ?? "")
              ? (evt.category as EventCategory)
              : source.defaultCategory;

            const id = `evt-${crypto.randomUUID()}`;
            const now = new Date().toISOString();
            await db.insert(schema.events).values({
              id,
              title: evt.name,
              description: evt.description ?? `External event from ${source.name}`,
              dateTime: startDate,
              endDateTime: endDate,
              locationId,
              status: "pending",
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
            result.errors.push(`${evt.name}: ${err}`);
            result.eventsSkipped++;
          }
        }
      } catch (err) {
        result.errors.push(`Post "${post.title}": ${err}`);
      }
    }

    // Record this scrape run
    const runId = `run-${crypto.randomUUID()}`;
    const newestUrl = posts[0]?.url ?? lastRun?.lastScrapedUrl ?? null;

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

    results.push(result);
  }

  console.log("\n=== Scraper Summary ===");
  for (const r of results) {
    console.log(`  ${r.sourceId}: +${r.eventsAdded} added, ${r.eventsSkipped} skipped, ${r.errors.length} errors`);
  }

  await pool.end();

  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  if (totalErrors > 0) process.exit(1);
}

// ── Main ────────────────────────────────────────────────────────────

const mode = process.argv[2] ?? "scrape";

async function main() {
  switch (mode) {
    case "scrape":
      await runScrape();
      break;
    case "import":
      await runImport();
      break;
    case "auto":
      await runAuto();
      break;
    default:
      console.log(`Usage: npx tsx scripts/scrape-external-events.ts <mode>\n`);
      console.log(`Modes:`);
      console.log(`  scrape   Scrape newsletter text to scripts/scraped/ (no API key needed)`);
      console.log(`  import   Import events from scripts/scraped/<source>/events.json into DB`);
      console.log(`  auto     Full pipeline: scrape + LLM extract + import (needs ANTHROPIC_API_KEY)`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});

import type { EventCategory } from "@/types";

export interface ScrapeSource {
  /** Unique identifier for this source */
  id: string;
  /** Human-readable name */
  name: string;
  /** URL to start scraping from (archive page, event listing, etc.) */
  archiveUrl: string;
  /** Scraper strategy to use */
  type: "beehiiv-newsletter" | "static-html" | "ical-feed";
  /** Default event category when the scraper can't determine one */
  defaultCategory: EventCategory;
}

export const SCRAPE_SOURCES: ScrapeSource[] = [
  {
    id: "acro-insiders",
    name: "Acro Insiders",
    archiveUrl: "https://acroinsiders.beehiiv.com/archive",
    type: "beehiiv-newsletter",
    defaultCategory: "festival",
  },
];

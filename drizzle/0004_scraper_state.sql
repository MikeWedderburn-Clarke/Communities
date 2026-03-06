CREATE TABLE IF NOT EXISTS "scraper_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "source_id" text NOT NULL,
  "last_scraped_url" text,
  "last_run_at" text NOT NULL,
  "events_added" integer NOT NULL DEFAULT 0,
  "events_skipped" integer NOT NULL DEFAULT 0
);

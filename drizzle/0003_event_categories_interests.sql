ALTER TABLE "events" ADD COLUMN "event_category" text NOT NULL DEFAULT 'class';
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_external" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "external_url" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "poster_url" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_interests" (
  "event_id" text NOT NULL REFERENCES "events"("id"),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "event_interests_event_user_unique" ON "event_interests" ("event_id","user_id");

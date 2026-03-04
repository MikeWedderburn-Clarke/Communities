ALTER TABLE "rsvps" ADD COLUMN "occurrence_date" text;
--> statement-breakpoint
DROP INDEX "rsvps_event_user_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "rsvps_no_occurrence_unique" ON "rsvps" ("event_id","user_id") WHERE occurrence_date IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "rsvps_occurrence_unique" ON "rsvps" ("event_id","user_id","occurrence_date") WHERE occurrence_date IS NOT NULL;

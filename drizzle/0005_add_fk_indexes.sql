CREATE INDEX IF NOT EXISTS "rsvps_user_id_idx" ON "rsvps" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "egm_event_id_idx" ON "event_group_members" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tte_event_id_idx" ON "ticket_type_events" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_user_id_idx" ON "bookings" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_ticket_type_id_idx" ON "bookings" ("ticket_type_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_interests_user_id_idx" ON "event_interests" ("user_id");

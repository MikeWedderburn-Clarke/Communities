CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"date_time" text NOT NULL,
	"end_date_time" text NOT NULL,
	"location_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" text,
	"date_added" text NOT NULL,
	"last_updated" text NOT NULL,
	"recurrence_type" text DEFAULT 'none' NOT NULL,
	"recurrence_end_date" text,
	"skill_level" text DEFAULT 'All levels' NOT NULL,
	"prerequisites" text,
	"cost_amount" double precision,
	"cost_currency" text,
	"concession_amount" double precision,
	"max_attendees" integer
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"what3names" text,
	"how_to_find" text,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"show_name" boolean DEFAULT false NOT NULL,
	"is_teaching" boolean DEFAULT false NOT NULL,
	"payment_status" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_teacher_approved" boolean DEFAULT false NOT NULL,
	"teacher_requested_at" text,
	"teacher_approved_by" text,
	"default_role" text,
	"default_show_name" boolean,
	"facebook_url" text,
	"instagram_url" text,
	"website_url" text,
	"youtube_url" text,
	"show_facebook" boolean DEFAULT false NOT NULL,
	"show_instagram" boolean DEFAULT false NOT NULL,
	"show_website" boolean DEFAULT false NOT NULL,
	"show_youtube" boolean DEFAULT false NOT NULL,
	"home_city" text,
	"use_current_location" boolean DEFAULT false NOT NULL,
	"last_login" text,
	"previous_login" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_status_datetime_idx" ON "events" USING btree ("status","date_time");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_name_city_country_unique" ON "locations" USING btree ("name","city","country");--> statement-breakpoint
CREATE UNIQUE INDEX "rsvps_event_user_unique" ON "rsvps" USING btree ("event_id","user_id");
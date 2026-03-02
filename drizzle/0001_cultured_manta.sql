CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ticket_type_id" text NOT NULL,
	"role" text,
	"show_name" boolean DEFAULT false NOT NULL,
	"is_teaching" boolean DEFAULT false NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"amount_paid" double precision,
	"currency" text,
	"booked_at" text NOT NULL,
	"cancelled_at" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "event_group_members" (
	"group_id" text NOT NULL,
	"event_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_splits" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_type_id" text NOT NULL,
	"teacher_user_id" text NOT NULL,
	"fixed_amount" double precision NOT NULL,
	"currency" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_type_events" (
	"ticket_type_id" text NOT NULL,
	"event_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cost_amount" double precision NOT NULL,
	"cost_currency" text NOT NULL,
	"concession_amount" double precision,
	"capacity" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_group_members" ADD CONSTRAINT "event_group_members_group_id_event_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."event_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_group_members" ADD CONSTRAINT "event_group_members_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_groups" ADD CONSTRAINT "event_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_splits" ADD CONSTRAINT "teacher_splits_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_splits" ADD CONSTRAINT "teacher_splits_teacher_user_id_users_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_type_events" ADD CONSTRAINT "ticket_type_events_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_type_events" ADD CONSTRAINT "ticket_type_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_group_id_event_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."event_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_user_ticket_unique" ON "bookings" USING btree ("user_id","ticket_type_id") WHERE payment_status != 'refunded';--> statement-breakpoint
CREATE UNIQUE INDEX "egm_group_event_unique" ON "event_group_members" USING btree ("group_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ts_ticket_teacher_unique" ON "teacher_splits" USING btree ("ticket_type_id","teacher_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tte_ticket_event_unique" ON "ticket_type_events" USING btree ("ticket_type_id","event_id");
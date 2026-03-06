ALTER TABLE "users" ADD COLUMN "profile_visibility" text NOT NULL DEFAULT 'everyone';
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "show_facebook";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "show_instagram";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "show_website";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "show_youtube";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_relationships" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "target_user_id" text NOT NULL REFERENCES "users"("id"),
  "type" text NOT NULL,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_relationships_user_target_unique" ON "user_relationships" ("user_id","target_user_id");
--> statement-breakpoint
CREATE INDEX "user_relationships_target_idx" ON "user_relationships" ("target_user_id");

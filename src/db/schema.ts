import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  isTeacherApproved: integer("is_teacher_approved", { mode: "boolean" }).notNull().default(false),
  teacherRequestedAt: text("teacher_requested_at"), // ISO-8601 or null
  teacherApprovedBy: text("teacher_approved_by"),
  // Profile defaults
  defaultRole: text("default_role"), // nullable: "Base" | "Flyer" | "Hybrid"
  defaultShowName: integer("default_show_name", { mode: "boolean" }),
  // Social links
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  websiteUrl: text("website_url"),
  youtubeUrl: text("youtube_url"),
  showFacebook: integer("show_facebook", { mode: "boolean" }).notNull().default(false),
  showInstagram: integer("show_instagram", { mode: "boolean" }).notNull().default(false),
  showWebsite: integer("show_website", { mode: "boolean" }).notNull().default(false),
  showYoutube: integer("show_youtube", { mode: "boolean" }).notNull().default(false),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dateTime: text("date_time").notNull(), // ISO-8601
  endDateTime: text("end_date_time").notNull(), // ISO-8601
  location: text("location").notNull(),
  country: text("country").notNull(),
  city: text("city").notNull(),
});

export const rsvps = sqliteTable("rsvps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role", { enum: ["Base", "Flyer", "Hybrid"] }).notNull(),
  showName: integer("show_name", { mode: "boolean" }).notNull().default(false),
  isTeaching: integer("is_teaching", { mode: "boolean" }).notNull().default(false),
});

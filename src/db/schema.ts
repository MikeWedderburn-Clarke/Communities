import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dateTime: text("date_time").notNull(), // ISO-8601
  endDateTime: text("end_date_time").notNull(), // ISO-8601
  location: text("location").notNull(),
});

export const rsvps = sqliteTable("rsvps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role", { enum: ["Base", "Flyer", "Hybrid", "Spotter"] }).notNull(),
  showName: integer("show_name", { mode: "boolean" }).notNull().default(false),
});

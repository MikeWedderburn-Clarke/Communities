import {
  pgTable,
  text, boolean, doublePrecision, integer, serial,
  uniqueIndex, index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  isAdmin: boolean("is_admin").notNull().default(false),
  isTeacherApproved: boolean("is_teacher_approved").notNull().default(false),
  teacherRequestedAt: text("teacher_requested_at"),
  teacherApprovedBy: text("teacher_approved_by"),
  // Profile defaults
  defaultRole: text("default_role"), // nullable: "Base" | "Flyer" | "Hybrid"
  defaultShowName: boolean("default_show_name"),
  // Social links
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  websiteUrl: text("website_url"),
  youtubeUrl: text("youtube_url"),
  // Profile visibility: who can see social links
  profileVisibility: text("profile_visibility").notNull().default("everyone"),
  // "everyone" | "followers" | "friends"
  // Home city
  homeCity: text("home_city"),
  useCurrentLocation: boolean("use_current_location").notNull().default(false),
  lastLogin: text("last_login"),
  previousLogin: text("previous_login"),
});

export const locations = pgTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  what3names: text("what3names"),
  howToFind: text("how_to_find"),
  createdBy: text("created_by").references(() => users.id),
}, (table) => ([
  uniqueIndex("locations_name_city_country_unique").on(table.name, table.city, table.country),
]));

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dateTime: text("date_time").notNull(), // ISO-8601
  endDateTime: text("end_date_time").notNull(), // ISO-8601
  locationId: text("location_id")
    .notNull()
    .references(() => locations.id),
  status: text("status").notNull().default("pending"), // "approved" | "pending" | "rejected"
  createdBy: text("created_by").references(() => users.id),
  dateAdded: text("date_added").notNull(),
  lastUpdated: text("last_updated").notNull(),
  recurrenceType: text("recurrence_type").notNull().default("none"), // "none" | "daily" | "weekly" | "monthly"
  recurrenceEndDate: text("recurrence_end_date"),
  skillLevel: text("skill_level").notNull().default("All levels"), // "Beginner" | "Intermediate" | "Advanced" | "All levels"
  prerequisites: text("prerequisites"),
  costAmount: doublePrecision("cost_amount"),
  costCurrency: text("cost_currency"),
  concessionAmount: doublePrecision("concession_amount"),
  maxAttendees: integer("max_attendees"), // nullable; null = no limit
  eventCategory: text("event_category").notNull().default("class"), // "festival" | "workshop" | "class" | "jam"
  isExternal: boolean("is_external").notNull().default(false),
  externalUrl: text("external_url"),     // nullable; URL for external booking
  posterUrl: text("poster_url"),         // nullable; image URL for poster
}, (table) => ([
  // Composite index covering the WHERE status='approved' + ORDER BY date_time
  // used by getAllEvents / getUpcomingEvents on every page load.
  index("events_status_datetime_idx").on(table.status, table.dateTime),
]));

export const rsvps = pgTable("rsvps", {
  id: serial("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull(), // "Base" | "Flyer" | "Hybrid"
  showName: boolean("show_name").notNull().default(false),
  isTeaching: boolean("is_teaching").notNull().default(false),
  paymentStatus: text("payment_status"), // nullable; null = unpaid; "full" | "concession" | extensible
  // null = standing RSVP (non-recurring or legacy); "YYYY-MM-DD" = specific occurrence
  occurrenceDate: text("occurrence_date"),
}, (table) => ([
  // Two partial unique indexes — managed manually in the migration SQL:
  //   "rsvps_no_occurrence_unique"  ON (event_id, user_id)           WHERE occurrence_date IS NULL
  //   "rsvps_occurrence_unique"     ON (event_id, user_id, occurrence_date) WHERE occurrence_date IS NOT NULL
  index("rsvps_no_occurrence_unique").on(table.eventId, table.userId),
  index("rsvps_occurrence_unique").on(table.eventId, table.userId, table.occurrenceDate),
  index("rsvps_user_id_idx").on(table.userId),
]));

// ── Event Groups ─────────────────────────────────────────────────────
// A named container linking multiple events into a festival, combo, or series.

export const eventGroups = pgTable("event_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // "festival" | "combo" | "series"
  status: text("status").notNull().default("draft"), // "draft" | "published"
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Event Group Members ──────────────────────────────────────────────
// Links existing events into a group. One event can belong to at most one group.

export const eventGroupMembers = pgTable("event_group_members", {
  groupId: text("group_id")
    .notNull()
    .references(() => eventGroups.id),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ([
  uniqueIndex("egm_group_event_unique").on(t.groupId, t.eventId),
  index("egm_event_id_idx").on(t.eventId),
]));

// ── Ticket Types ─────────────────────────────────────────────────────
// Defines what can be purchased for an event group (e.g. "Full Festival Pass", "Day 1 Pass").
// Each ticket type has its own independent capacity pool.

export const ticketTypes = pgTable("ticket_types", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => eventGroups.id),
  name: text("name").notNull(),
  description: text("description"),
  costAmount: doublePrecision("cost_amount").notNull(),
  costCurrency: text("cost_currency").notNull(),
  concessionAmount: doublePrecision("concession_amount"), // null = no concession offered
  capacity: integer("capacity"), // null = unlimited
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Ticket Type Events ───────────────────────────────────────────────
// Maps which event(s)/days a ticket type grants access to.
// A full festival pass would cover all days; a day pass covers one specific day.

export const ticketTypeEvents = pgTable("ticket_type_events", {
  ticketTypeId: text("ticket_type_id")
    .notNull()
    .references(() => ticketTypes.id),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
}, (t) => ([
  uniqueIndex("tte_ticket_event_unique").on(t.ticketTypeId, t.eventId),
  index("tte_event_id_idx").on(t.eventId),
]));

// ── Bookings ─────────────────────────────────────────────────────────
// Tracks who has purchased (or is pending payment for) a ticket type.
// NOTE: The unique index bookings_user_ticket_unique is generated by drizzle-kit as a
// full index, but should be manually patched in the migration SQL to be a PARTIAL index:
//   WHERE payment_status != 'refunded'
// This allows a user to re-book the same ticket type after a refund.

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  ticketTypeId: text("ticket_type_id")
    .notNull()
    .references(() => ticketTypes.id),
  role: text("role"), // "Base" | "Flyer" | "Hybrid" | null
  showName: boolean("show_name").notNull().default(false),
  isTeaching: boolean("is_teaching").notNull().default(false),
  paymentStatus: text("payment_status").notNull().default("pending"),
  // "pending" | "paid" | "concession_paid" | "comp" | "refunded"
  amountPaid: doublePrecision("amount_paid"),
  currency: text("currency"),
  bookedAt: text("booked_at").notNull(),
  cancelledAt: text("cancelled_at"), // set when paymentStatus = "refunded"
  notes: text("notes"),
}, (t) => ([
  uniqueIndex("bookings_user_ticket_unique").on(t.userId, t.ticketTypeId),
  index("bookings_user_id_idx").on(t.userId),
  index("bookings_ticket_type_id_idx").on(t.ticketTypeId),
]));

// ── Teacher Splits ───────────────────────────────────────────────────
// Defines how much a teacher earns per confirmed booking of a given ticket type.
// Uses a fixed-amount-per-booking model (not a percentage).

export const teacherSplits = pgTable("teacher_splits", {
  id: text("id").primaryKey(),
  ticketTypeId: text("ticket_type_id")
    .notNull()
    .references(() => ticketTypes.id),
  teacherUserId: text("teacher_user_id")
    .notNull()
    .references(() => users.id),
  fixedAmount: doublePrecision("fixed_amount").notNull(),
  currency: text("currency").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ([
  uniqueIndex("ts_ticket_teacher_unique").on(t.ticketTypeId, t.teacherUserId),
]));

// ── Scraper Runs ────────────────────────────────────────────────────
// Tracks when each external source was last scraped, to avoid re-processing
// the same newsletter posts or event pages.

export const scraperRuns = pgTable("scraper_runs", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  lastScrapedUrl: text("last_scraped_url"),
  lastRunAt: text("last_run_at").notNull(),
  eventsAdded: integer("events_added").notNull().default(0),
  eventsSkipped: integer("events_skipped").notNull().default(0),
});

// ── Event Interests ─────────────────────────────────────────────────
// Lightweight "interested" / watchlist signal. Separate from RSVPs so
// the RSVP system (with roles, occurrence dates, etc.) stays unchanged.

export const eventInterests = pgTable("event_interests", {
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull(),
}, (table) => ([
  uniqueIndex("event_interests_event_user_unique").on(table.eventId, table.userId),
  index("event_interests_user_id_idx").on(table.userId),
]));

// ── User Relationships ──────────────────────────────────────────────
// Directional relationship: userId sets their view of targetUserId.
// type: "following" | "friend"

export const userRelationships = pgTable("user_relationships", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  targetUserId: text("target_user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(), // "following" | "friend"
  createdAt: text("created_at").notNull(),
}, (table) => ([
  uniqueIndex("user_relationships_user_target_unique").on(table.userId, table.targetUserId),
  index("user_relationships_target_idx").on(table.targetUserId),
]));

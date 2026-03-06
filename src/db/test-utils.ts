import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";
import type { Db } from "./index";

/**
 * Create a fresh in-memory PostgreSQL database for testing via PGlite.
 * Uses the same drizzle/pg-core column types as production so boolean,
 * doublePrecision etc. all serialize correctly.
 */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite();

  await client.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      is_teacher_approved BOOLEAN NOT NULL DEFAULT false,
      teacher_requested_at TEXT,
      teacher_approved_by TEXT,
      default_role TEXT,
      default_show_name BOOLEAN,
      facebook_url TEXT,
      instagram_url TEXT,
      website_url TEXT,
      youtube_url TEXT,
      show_facebook BOOLEAN NOT NULL DEFAULT false,
      show_instagram BOOLEAN NOT NULL DEFAULT false,
      show_website BOOLEAN NOT NULL DEFAULT false,
      show_youtube BOOLEAN NOT NULL DEFAULT false,
      home_city TEXT,
      use_current_location BOOLEAN NOT NULL DEFAULT false,
      last_login TEXT,
      previous_login TEXT
    );
    CREATE TABLE locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      what3names TEXT,
      how_to_find TEXT,
      created_by TEXT REFERENCES users(id)
    );
    CREATE UNIQUE INDEX locations_name_city_country_unique ON locations(name, city, country);
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      date_time TEXT NOT NULL,
      end_date_time TEXT NOT NULL,
      location_id TEXT NOT NULL REFERENCES locations(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('approved','pending','rejected')),
      created_by TEXT REFERENCES users(id),
      date_added TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      recurrence_type TEXT NOT NULL DEFAULT 'none' CHECK(recurrence_type IN ('none','daily','weekly','monthly')),
      recurrence_end_date TEXT,
      skill_level TEXT NOT NULL DEFAULT 'All levels' CHECK(skill_level IN ('Beginner','Intermediate','Advanced','All levels')),
      prerequisites TEXT,
      cost_amount DOUBLE PRECISION,
      cost_currency TEXT,
      concession_amount DOUBLE PRECISION,
      max_attendees INTEGER,
      event_category TEXT NOT NULL DEFAULT 'class',
      is_external BOOLEAN NOT NULL DEFAULT false,
      external_url TEXT,
      poster_url TEXT
    );
    CREATE TABLE rsvps (
      id SERIAL PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK(role IN ('Base','Flyer','Hybrid')),
      show_name BOOLEAN NOT NULL DEFAULT false,
      is_teaching BOOLEAN NOT NULL DEFAULT false,
      payment_status TEXT,
      occurrence_date TEXT
    );
    CREATE UNIQUE INDEX rsvps_no_occurrence_unique ON rsvps(event_id, user_id) WHERE occurrence_date IS NULL;
    CREATE UNIQUE INDEX rsvps_occurrence_unique ON rsvps(event_id, user_id, occurrence_date) WHERE occurrence_date IS NOT NULL;
    CREATE INDEX events_status_datetime_idx ON events(status, date_time);
    CREATE TABLE event_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE event_group_members (
      group_id TEXT NOT NULL REFERENCES event_groups(id),
      event_id TEXT NOT NULL REFERENCES events(id),
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX egm_group_event_unique ON event_group_members(group_id, event_id);
    CREATE TABLE ticket_types (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES event_groups(id),
      name TEXT NOT NULL,
      description TEXT,
      cost_amount DOUBLE PRECISION NOT NULL,
      cost_currency TEXT NOT NULL,
      concession_amount DOUBLE PRECISION,
      capacity INTEGER,
      is_available BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE ticket_type_events (
      ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id),
      event_id TEXT NOT NULL REFERENCES events(id)
    );
    CREATE UNIQUE INDEX tte_ticket_event_unique ON ticket_type_events(ticket_type_id, event_id);
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id),
      role TEXT,
      show_name BOOLEAN NOT NULL DEFAULT false,
      is_teaching BOOLEAN NOT NULL DEFAULT false,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      amount_paid DOUBLE PRECISION,
      currency TEXT,
      booked_at TEXT NOT NULL,
      cancelled_at TEXT,
      notes TEXT
    );
    CREATE UNIQUE INDEX bookings_user_ticket_unique ON bookings(user_id, ticket_type_id) WHERE payment_status != 'refunded';
    CREATE TABLE teacher_splits (
      id TEXT PRIMARY KEY,
      ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id),
      teacher_user_id TEXT NOT NULL REFERENCES users(id),
      fixed_amount DOUBLE PRECISION NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX ts_ticket_teacher_unique ON teacher_splits(ticket_type_id, teacher_user_id);
    CREATE TABLE event_interests (
      event_id TEXT NOT NULL REFERENCES events(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX event_interests_event_user_unique ON event_interests(event_id, user_id);
    CREATE TABLE scraper_runs (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      last_scraped_url TEXT,
      last_run_at TEXT NOT NULL,
      events_added INTEGER NOT NULL DEFAULT 0,
      events_skipped INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Attach the raw PGlite client so test afterAll hooks can call client.close().
  const drizzleDb = drizzle(client, { schema }) as unknown as Db;
  (drizzleDb as any).$pglite = client;
  return drizzleDb;
}

/**
 * Delete all rows from every table in proper foreign-key order.
 * Use this in beforeEach when you want to reuse a single createTestDb() instance
 * across many tests (avoiding the heavy per-test WASM allocation).
 */
export async function resetDb(db: Db): Promise<void> {
  await db.delete(schema.scraperRuns);
  await db.delete(schema.teacherSplits);
  await db.delete(schema.bookings);
  await db.delete(schema.ticketTypeEvents);
  await db.delete(schema.ticketTypes);
  await db.delete(schema.eventGroupMembers);
  await db.delete(schema.eventGroups);
  await db.delete(schema.rsvps);
  await db.delete(schema.eventInterests);
  await db.delete(schema.events);
  await db.delete(schema.locations);
  await db.delete(schema.users);
}

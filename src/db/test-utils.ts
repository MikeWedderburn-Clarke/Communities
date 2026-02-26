import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

/**
 * Create a fresh in-memory database for testing.
 * Returns the drizzle instance.
 */
export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const testDb = drizzle(sqlite, { schema });

  // Create tables
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_teacher_approved INTEGER NOT NULL DEFAULT 0,
      teacher_requested_at TEXT,
      teacher_approved_by TEXT,
      default_role TEXT,
      default_show_name INTEGER,
      facebook_url TEXT,
      instagram_url TEXT,
      website_url TEXT,
      youtube_url TEXT,
      show_facebook INTEGER NOT NULL DEFAULT 0,
      show_instagram INTEGER NOT NULL DEFAULT 0,
      show_website INTEGER NOT NULL DEFAULT 0,
      show_youtube INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
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
      created_by TEXT REFERENCES users(id)
    );
    CREATE TABLE rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK(role IN ('Base','Flyer','Hybrid')),
      show_name INTEGER NOT NULL DEFAULT 0,
      is_teaching INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX rsvps_event_user_unique ON rsvps(event_id, user_id);
  `);

  return testDb;
}

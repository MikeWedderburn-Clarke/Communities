import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "community.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// ── Create tables ──────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
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
    show_youtube INTEGER NOT NULL DEFAULT 0,
    home_city TEXT,
    use_current_location INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    created_by TEXT REFERENCES users(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS locations_name_city_country_unique ON locations(name, city, country);
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    date_time TEXT NOT NULL,
    end_date_time TEXT NOT NULL,
    location_id TEXT NOT NULL REFERENCES locations(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('approved','pending','rejected')),
    created_by TEXT REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL REFERENCES events(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('Base','Flyer','Hybrid')),
    show_name INTEGER NOT NULL DEFAULT 0,
    is_teaching INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS rsvps_event_user_unique ON rsvps(event_id, user_id);
  CREATE INDEX IF NOT EXISTS events_status_datetime_idx ON events(status, date_time);
`);

// ── Seed users (mock auth accounts) ────────────────────────────────
const seedUsers = [
  {
    id: "user-alice", name: "Alice Johnson", email: "alice@example.com",
    isAdmin: 0, isTeacherApproved: 1,
    teacherRequestedAt: "2026-01-01T00:00:00Z", teacherApprovedBy: "user-dan",
    defaultRole: "Base", defaultShowName: 1,
    facebookUrl: "https://facebook.com/alicejohnson", instagramUrl: "https://instagram.com/alice_acro",
    websiteUrl: null, youtubeUrl: null,
    showFacebook: 1, showInstagram: 1, showWebsite: 0, showYoutube: 0,
  },
  {
    id: "user-bob", name: "Bob Smith", email: "bob@example.com",
    isAdmin: 0, isTeacherApproved: 0,
    teacherRequestedAt: "2026-02-20T00:00:00Z", teacherApprovedBy: null,
    defaultRole: "Flyer", defaultShowName: 1,
    facebookUrl: null, instagramUrl: "https://instagram.com/bob_flies",
    websiteUrl: null, youtubeUrl: null,
    showFacebook: 0, showInstagram: 1, showWebsite: 0, showYoutube: 0,
  },
  {
    id: "user-carol", name: "Carol Williams", email: "carol@example.com",
    isAdmin: 0, isTeacherApproved: 0,
    teacherRequestedAt: null, teacherApprovedBy: null,
    defaultRole: null, defaultShowName: null,
    facebookUrl: null, instagramUrl: null,
    websiteUrl: null, youtubeUrl: null,
    showFacebook: 0, showInstagram: 0, showWebsite: 0, showYoutube: 0,
  },
  {
    id: "user-dan", name: "Dan Brown", email: "dan@example.com",
    isAdmin: 1, isTeacherApproved: 0,
    teacherRequestedAt: null, teacherApprovedBy: null,
    defaultRole: "Flyer", defaultShowName: 0,
    facebookUrl: null, instagramUrl: null,
    websiteUrl: "https://danbrown-acro.com", youtubeUrl: null,
    showFacebook: 0, showInstagram: 0, showWebsite: 1, showYoutube: 0,
  },
];

const insertUser = sqlite.prepare(
  `INSERT OR IGNORE INTO users
   (id, name, email, is_admin, is_teacher_approved, teacher_requested_at, teacher_approved_by,
    default_role, default_show_name, facebook_url, instagram_url, website_url, youtube_url,
    show_facebook, show_instagram, show_website, show_youtube, home_city, use_current_location)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const u of seedUsers) {
  insertUser.run(
    u.id, u.name, u.email, u.isAdmin, u.isTeacherApproved, u.teacherRequestedAt, u.teacherApprovedBy,
    u.defaultRole, u.defaultShowName, u.facebookUrl, u.instagramUrl, u.websiteUrl, u.youtubeUrl,
    u.showFacebook, u.showInstagram, u.showWebsite, u.showYoutube, null, 0
  );
}

// ── Seed locations (London + New York + Bristol + Bournemouth) ──────
const seedLocations = [
  { id: "loc-regents-park", name: "Regent's Park", city: "London", country: "United Kingdom", latitude: 51.5273, longitude: -0.1535 },
  { id: "loc-gym-brixton", name: "The Gym Group Brixton", city: "London", country: "United Kingdom", latitude: 51.4613, longitude: -0.1150 },
  { id: "loc-colombo", name: "Colombo Centre, Elephant & Castle", city: "London", country: "United Kingdom", latitude: 51.4946, longitude: -0.1008 },
  { id: "loc-laban", name: "Laban Dance Centre, Greenwich", city: "London", country: "United Kingdom", latitude: 51.4741, longitude: -0.0143 },
  { id: "loc-victoria-park", name: "Victoria Park, Hackney", city: "London", country: "United Kingdom", latitude: 51.5368, longitude: -0.0396 },
  // New York
  { id: "loc-central-park", name: "Central Park Great Lawn", city: "New York", country: "United States", latitude: 40.7812, longitude: -73.9665 },
  { id: "loc-prospect-park", name: "Prospect Park Long Meadow", city: "New York", country: "United States", latitude: 40.6602, longitude: -73.9690 },
  { id: "loc-domino-park", name: "Domino Park, Williamsburg", city: "New York", country: "United States", latitude: 40.7135, longitude: -73.9683 },
  // Bristol
  { id: "loc-castle-park", name: "Castle Park", city: "Bristol", country: "United Kingdom", latitude: 51.4530, longitude: -2.5900 },
  { id: "loc-the-motion", name: "The Motion", city: "Bristol", country: "United Kingdom", latitude: 51.4490, longitude: -2.5830 },
  // Bournemouth
  { id: "loc-boscombe-beach", name: "Boscombe Beach", city: "Bournemouth", country: "United Kingdom", latitude: 50.7198, longitude: -1.8400 },
  { id: "loc-shelley-park", name: "Shelley Park", city: "Bournemouth", country: "United Kingdom", latitude: 50.7220, longitude: -1.8530 },
];

const insertLocation = sqlite.prepare(
  "INSERT OR IGNORE INTO locations (id, name, city, country, latitude, longitude, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
for (const l of seedLocations) {
  insertLocation.run(l.id, l.name, l.city, l.country, l.latitude, l.longitude, "user-dan");
}

// ── Seed events (London AcroYoga) ──────────────────────────────────
const seedEvents = [
  {
    id: "evt-sunday-jam",
    title: "Sunday AcroYoga Jam",
    description:
      "Open-level jam in Regent's Park. Bring a mat and good vibes! All levels welcome.",
    dateTime: "2026-03-08T11:00:00Z",
    endDateTime: "2026-03-08T14:00:00Z",
    locationId: "loc-regents-park",
  },
  {
    id: "evt-beginner-workshop",
    title: "Beginner AcroYoga Workshop",
    description:
      "A 2-hour introduction to AcroYoga covering bird, throne, and basic washing machines. No partner required — we rotate throughout.",
    dateTime: "2026-03-14T10:00:00Z",
    endDateTime: "2026-03-14T12:00:00Z",
    locationId: "loc-gym-brixton",
  },
  {
    id: "evt-flight-night",
    title: "Friday Flight Night",
    description:
      "Weekly evening session focused on intermediate flows and standing acro. Warm-up included. Mats provided.",
    dateTime: "2026-03-20T18:30:00Z",
    endDateTime: "2026-03-20T21:00:00Z",
    locationId: "loc-colombo",
  },
  {
    id: "evt-washing-machine",
    title: "Washing Machine Masterclass",
    description:
      "Deep dive into washing machine transitions — icarian, whip, and reverse flows. Intermediate level recommended.",
    dateTime: "2026-03-28T14:00:00Z",
    endDateTime: "2026-03-28T17:00:00Z",
    locationId: "loc-laban",
  },
  {
    id: "evt-park-jam-april",
    title: "Spring Park Jam",
    description:
      "Celebrating the warmer weather with a big outdoor jam. All levels, family-friendly. We'll have a dedicated beginners' circle.",
    dateTime: "2026-04-05T12:00:00Z",
    endDateTime: "2026-04-05T16:00:00Z",
    locationId: "loc-victoria-park",
  },
  // ── New York events (5) ──────────────────────────────────────────
  {
    id: "evt-ny-central-park-jam",
    title: "Central Park AcroYoga Jam",
    description:
      "Weekly open jam on the Great Lawn. All levels, bring a mat. We'll be near the Delacorte Theater.",
    dateTime: "2026-03-15T14:00:00Z",
    endDateTime: "2026-03-15T17:00:00Z",
    locationId: "loc-central-park",
  },
  {
    id: "evt-ny-beginner-intro",
    title: "NYC Beginner Intro to AcroYoga",
    description:
      "First time? Perfect. Learn bird, throne, and basic safety. Partners rotated throughout. No experience needed.",
    dateTime: "2026-03-22T11:00:00Z",
    endDateTime: "2026-03-22T13:00:00Z",
    locationId: "loc-central-park",
  },
  {
    id: "evt-ny-prospect-flow",
    title: "Prospect Park Flow Session",
    description:
      "Intermediate flow practice — washing machines, whips, and pops. Meet at the Long Meadow south entrance.",
    dateTime: "2026-03-29T10:00:00Z",
    endDateTime: "2026-03-29T12:30:00Z",
    locationId: "loc-prospect-park",
  },
  {
    id: "evt-ny-domino-sunset",
    title: "Sunset Acro at Domino Park",
    description:
      "Evening session with Manhattan skyline views. Standing acro and L-basing. Intermediate level.",
    dateTime: "2026-04-04T17:30:00Z",
    endDateTime: "2026-04-04T20:00:00Z",
    locationId: "loc-domino-park",
  },
  {
    id: "evt-ny-spring-festival",
    title: "NYC Spring AcroYoga Festival",
    description:
      "All-day festival with workshops, jams, and performances. Multiple teachers. All levels welcome!",
    dateTime: "2026-04-12T10:00:00Z",
    endDateTime: "2026-04-12T18:00:00Z",
    locationId: "loc-prospect-park",
  },
  // ── Bristol events (3) ───────────────────────────────────────────
  {
    id: "evt-bristol-castle-jam",
    title: "Bristol Castle Park Jam",
    description:
      "Friendly open jam in Castle Park. All levels, just bring a mat and a smile.",
    dateTime: "2026-03-16T11:00:00Z",
    endDateTime: "2026-03-16T14:00:00Z",
    locationId: "loc-castle-park",
  },
  {
    id: "evt-bristol-motion-workshop",
    title: "Bristol Intermediate Workshop",
    description:
      "Two-hour workshop at The Motion covering intermediate flows, pops, and icarian. Some experience recommended.",
    dateTime: "2026-03-23T14:00:00Z",
    endDateTime: "2026-03-23T16:00:00Z",
    locationId: "loc-the-motion",
  },
  {
    id: "evt-bristol-spring-jam",
    title: "Bristol Spring Outdoor Jam",
    description:
      "Welcoming the spring sunshine with an outdoor session. Beginners corner available. Bring snacks to share!",
    dateTime: "2026-04-06T12:00:00Z",
    endDateTime: "2026-04-06T15:00:00Z",
    locationId: "loc-castle-park",
  },
  // ── Bournemouth events (2) ───────────────────────────────────────
  {
    id: "evt-bournemouth-beach-acro",
    title: "Boscombe Beach AcroYoga",
    description:
      "AcroYoga on the sand! Soft landing guaranteed. All levels. Meet by the pier at 10am.",
    dateTime: "2026-03-21T10:00:00Z",
    endDateTime: "2026-03-21T13:00:00Z",
    locationId: "loc-boscombe-beach",
  },
  {
    id: "evt-bournemouth-park-session",
    title: "Shelley Park Sunday Session",
    description:
      "Relaxed Sunday practice in Shelley Park. Bring a mat, water, and sunscreen. All abilities welcome.",
    dateTime: "2026-04-13T11:00:00Z",
    endDateTime: "2026-04-13T14:00:00Z",
    locationId: "loc-shelley-park",
  },
];

const insertEvent = sqlite.prepare(
  "INSERT OR IGNORE INTO events (id, title, description, date_time, end_date_time, location_id, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'approved', 'user-dan')"
);
for (const e of seedEvents) {
  insertEvent.run(e.id, e.title, e.description, e.dateTime, e.endDateTime, e.locationId);
}

// ── Seed RSVPs ──────────────────────────────────────────────────────
const seedRsvps = [
  { eventId: "evt-sunday-jam", userId: "user-alice", role: "Base", showName: 1, isTeaching: 1 },
  { eventId: "evt-sunday-jam", userId: "user-bob", role: "Flyer", showName: 1, isTeaching: 0 },
  { eventId: "evt-sunday-jam", userId: "user-carol", role: "Hybrid", showName: 0, isTeaching: 0 },
  { eventId: "evt-beginner-workshop", userId: "user-alice", role: "Base", showName: 1, isTeaching: 1 },
  { eventId: "evt-beginner-workshop", userId: "user-dan", role: "Flyer", showName: 1, isTeaching: 0 },
  { eventId: "evt-flight-night", userId: "user-bob", role: "Hybrid", showName: 1, isTeaching: 0 },
  { eventId: "evt-flight-night", userId: "user-carol", role: "Base", showName: 1, isTeaching: 0 },
  { eventId: "evt-flight-night", userId: "user-dan", role: "Flyer", showName: 0, isTeaching: 0 },
  { eventId: "evt-washing-machine", userId: "user-alice", role: "Flyer", showName: 1, isTeaching: 0 },
];

const insertRsvp = sqlite.prepare(
  "INSERT OR IGNORE INTO rsvps (event_id, user_id, role, show_name, is_teaching) VALUES (?, ?, ?, ?, ?)"
);
for (const r of seedRsvps) {
  insertRsvp.run(r.eventId, r.userId, r.role, r.showName, r.isTeaching);
}

console.log("Seed complete: %d users, %d locations, %d events, %d RSVPs", seedUsers.length, seedLocations.length, seedEvents.length, seedRsvps.length);
sqlite.close();

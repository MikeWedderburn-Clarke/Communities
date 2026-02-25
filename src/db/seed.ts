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
    show_youtube INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    date_time TEXT NOT NULL,
    end_date_time TEXT NOT NULL,
    location TEXT NOT NULL,
    country TEXT NOT NULL,
    city TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL REFERENCES events(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('Base','Flyer','Hybrid')),
    show_name INTEGER NOT NULL DEFAULT 0,
    is_teaching INTEGER NOT NULL DEFAULT 0
  );
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
    show_facebook, show_instagram, show_website, show_youtube)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const u of seedUsers) {
  insertUser.run(
    u.id, u.name, u.email, u.isAdmin, u.isTeacherApproved, u.teacherRequestedAt, u.teacherApprovedBy,
    u.defaultRole, u.defaultShowName, u.facebookUrl, u.instagramUrl, u.websiteUrl, u.youtubeUrl,
    u.showFacebook, u.showInstagram, u.showWebsite, u.showYoutube
  );
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
    location: "Regent's Park, London",
    country: "United Kingdom",
    city: "London",
  },
  {
    id: "evt-beginner-workshop",
    title: "Beginner AcroYoga Workshop",
    description:
      "A 2-hour introduction to AcroYoga covering bird, throne, and basic washing machines. No partner required — we rotate throughout.",
    dateTime: "2026-03-14T10:00:00Z",
    endDateTime: "2026-03-14T12:00:00Z",
    location: "The Gym Group Brixton, London",
    country: "United Kingdom",
    city: "London",
  },
  {
    id: "evt-flight-night",
    title: "Friday Flight Night",
    description:
      "Weekly evening session focused on intermediate flows and standing acro. Warm-up included. Mats provided.",
    dateTime: "2026-03-20T18:30:00Z",
    endDateTime: "2026-03-20T21:00:00Z",
    location: "Colombo Centre, Elephant & Castle, London",
    country: "United Kingdom",
    city: "London",
  },
  {
    id: "evt-washing-machine",
    title: "Washing Machine Masterclass",
    description:
      "Deep dive into washing machine transitions — icarian, whip, and reverse flows. Intermediate level recommended.",
    dateTime: "2026-03-28T14:00:00Z",
    endDateTime: "2026-03-28T17:00:00Z",
    location: "Laban Dance Centre, Greenwich, London",
    country: "United Kingdom",
    city: "London",
  },
  {
    id: "evt-park-jam-april",
    title: "Spring Park Jam",
    description:
      "Celebrating the warmer weather with a big outdoor jam. All levels, family-friendly. We'll have a dedicated beginners' circle.",
    dateTime: "2026-04-05T12:00:00Z",
    endDateTime: "2026-04-05T16:00:00Z",
    location: "Victoria Park, Hackney, London",
    country: "United Kingdom",
    city: "London",
  },
];

const insertEvent = sqlite.prepare(
  "INSERT OR IGNORE INTO events (id, title, description, date_time, end_date_time, location, country, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);
for (const e of seedEvents) {
  insertEvent.run(e.id, e.title, e.description, e.dateTime, e.endDateTime, e.location, e.country, e.city);
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

console.log("Seed complete: %d users, %d events, %d RSVPs", seedUsers.length, seedEvents.length, seedRsvps.length);
sqlite.close();

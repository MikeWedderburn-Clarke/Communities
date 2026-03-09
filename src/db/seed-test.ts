/**
 * Seed script for the TEST database.
 * Covers every major combination of event properties so all UI states
 * can be verified: skill levels, categories, recurrence, internal/external,
 * cost, max-attendees (full/not-full), past/upcoming/new/updated events,
 * multiple cities and countries.
 *
 * Usage:
 *   npm run db:migrate-test
 *   npm run db:seed-test
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import {
  users, locations, events, rsvps,
  eventGroups, eventGroupMembers, ticketTypes, eventInterests,
} from "./schema";

const testPool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
  ...(process.env.NODE_ENV === "production" && { ssl: true }),
});
const db = drizzle(testPool, { schema });

// ── Dates relative to seed time ──────────────────────────────────────
// "Now" in the seed is 2026-03-09 to keep the seed deterministic.
// Freshness badge logic (used on event cards and map bubbles):
//   - A user's `freshSince` = their `previousLogin` date.
//   - An event shows "New"     if `dateAdded`    > freshSince.
//   - An event shows "Updated" if `lastUpdated`  > freshSince AND dateAdded <= freshSince.
// For user-alice / user-dan: freshSince = LAST_LOGIN (2026-03-05).
//   → Events added or updated AFTER 2026-03-05 will show as New/Updated.
const NOW = "2026-03-09T12:00:00Z";
const LAST_LOGIN = "2026-03-05T08:00:00Z";      // freshSince for user-alice / dan
const PREVIOUS_LOGIN = "2026-03-01T00:00:00Z";  // anything added after this is "new/updated"

async function seed() {
  // ── Users ─────────────────────────────────────────────────────────────
  await db.insert(users).values([
    // Admin user — can toggle between test and live db
    {
      id: "user-dan",
      name: "Dan Brown (Admin)",
      email: "dan@example.com",
      isAdmin: true,
      isTeacherApproved: false,
      defaultRole: "Flyer",
      defaultShowName: false,
      websiteUrl: "https://danbrown-acro.com",
      homeCity: "London",
      useCurrentLocation: false,
      lastLogin: NOW,
      previousLogin: LAST_LOGIN,
    },
    // Approved teacher
    {
      id: "user-alice",
      name: "Alice Johnson",
      email: "alice@example.com",
      isAdmin: false,
      isTeacherApproved: true,
      teacherRequestedAt: "2026-01-01T00:00:00Z",
      teacherApprovedBy: "user-dan",
      defaultRole: "Base",
      defaultShowName: true,
      facebookUrl: "https://facebook.com/alicejohnson",
      instagramUrl: "https://instagram.com/alice_acro",
      homeCity: "London",
      useCurrentLocation: false,
      lastLogin: NOW,
      previousLogin: LAST_LOGIN,
    },
    // Regular user — pending teacher request
    {
      id: "user-bob",
      name: "Bob Smith",
      email: "bob@example.com",
      isAdmin: false,
      isTeacherApproved: false,
      teacherRequestedAt: "2026-02-20T00:00:00Z",
      defaultRole: "Flyer",
      defaultShowName: true,
      instagramUrl: "https://instagram.com/bob_flies",
      homeCity: "London",
      useCurrentLocation: false,
      lastLogin: "2026-03-02T10:30:00Z",
      previousLogin: PREVIOUS_LOGIN,
    },
    // Regular user — no profile set up
    {
      id: "user-carol",
      name: "Carol Williams",
      email: "carol@example.com",
      isAdmin: false,
      isTeacherApproved: false,
      homeCity: null,
      useCurrentLocation: false,
      lastLogin: null,
      previousLogin: null,
    },
    // International user
    {
      id: "user-emma",
      name: "Emma Dubois",
      email: "emma@example.com",
      isAdmin: false,
      isTeacherApproved: true,
      teacherRequestedAt: "2026-01-15T00:00:00Z",
      teacherApprovedBy: "user-dan",
      defaultRole: "Hybrid",
      defaultShowName: true,
      instagramUrl: "https://instagram.com/emma_acro_paris",
      homeCity: "Paris",
      useCurrentLocation: false,
      lastLogin: "2026-03-08T09:00:00Z",
      previousLogin: "2026-02-25T00:00:00Z",
    },
  ]).onConflictDoNothing();

  // ── Locations ─────────────────────────────────────────────────────────
  await db.insert(locations).values([
    // London
    { id: "t-loc-regents-park", name: "Regent's Park", city: "London", country: "United Kingdom", latitude: 51.5273, longitude: -0.1535, what3names: "gently.snowy.magic", howToFind: "Meet near the bandstand by the cafe.", createdBy: "user-dan" },
    { id: "t-loc-gym-brixton", name: "The Gym Group Brixton", city: "London", country: "United Kingdom", latitude: 51.4613, longitude: -0.1150, what3names: "bench.crossing.now", howToFind: "Enter through the main gym on Brixton Hill.", createdBy: "user-dan" },
    { id: "t-loc-colombo", name: "Colombo Centre, Elephant & Castle", city: "London", country: "United Kingdom", latitude: 51.4946, longitude: -0.1008, createdBy: "user-dan" },
    { id: "t-loc-laban", name: "Laban Dance Centre, Greenwich", city: "London", country: "United Kingdom", latitude: 51.4741, longitude: -0.0143, createdBy: "user-dan" },
    { id: "t-loc-victoria-park", name: "Victoria Park, Hackney", city: "London", country: "United Kingdom", latitude: 51.5368, longitude: -0.0396, createdBy: "user-dan" },
    // New York
    { id: "t-loc-central-park", name: "Central Park Great Lawn", city: "New York", country: "United States", latitude: 40.7812, longitude: -73.9665, what3names: "open.perfect.lawn", howToFind: "Meet near the Delacorte Theater steps.", createdBy: "user-dan" },
    { id: "t-loc-prospect-park", name: "Prospect Park Long Meadow", city: "New York", country: "United States", latitude: 40.6602, longitude: -73.9690, createdBy: "user-dan" },
    // Bristol
    { id: "t-loc-castle-park", name: "Castle Park", city: "Bristol", country: "United Kingdom", latitude: 51.4530, longitude: -2.5900, createdBy: "user-dan" },
    // Paris
    { id: "t-loc-trocadero", name: "Trocadéro Gardens", city: "Paris", country: "France", latitude: 48.8614, longitude: 2.2892, what3names: "echo.planet.river", howToFind: "Meet at the fountain facing the Eiffel Tower.", createdBy: "user-dan" },
    { id: "t-loc-parc-belleville", name: "Parc de Belleville", city: "Paris", country: "France", latitude: 48.8688, longitude: 2.3849, createdBy: "user-dan" },
    // Berlin
    { id: "t-loc-tiergarten", name: "Tiergarten", city: "Berlin", country: "Germany", latitude: 52.5145, longitude: 13.3501, createdBy: "user-dan" },
    // Sydney
    { id: "t-loc-bondi-beach", name: "Bondi Beach Parklands", city: "Sydney", country: "Australia", latitude: -33.8914, longitude: 151.2767, createdBy: "user-dan" },
  ]).onConflictDoNothing();

  // ── Events — comprehensive matrix ─────────────────────────────────────
  // Status combinations:
  //   - approved (most events)
  //   - pending (admin review queue)
  //   - rejected
  // Skill levels: Beginner, Intermediate, Advanced, All levels
  // Categories: jam, class, workshop, festival
  // Recurrence: none, weekly, monthly, daily
  // Internal vs external
  // With/without cost, concession, max-attendees
  // Past / upcoming / "new" / "updated" freshness states

  await db.insert(events).values([
    // ────────────────────────────────────────────────────
    // 1. JAM — All levels — FREE — Weekly recurring — upcoming (FRESH/NEW)
    {
      id: "t-evt-weekly-jam",
      title: "[TEST] Sunday AcroYoga Jam (Regent's Park)",
      description: "Open-level weekly jam. Bring a mat and good vibes! All levels welcome. This is a recurring weekly event.",
      dateTime: "2026-03-15T11:00:00Z",
      endDateTime: "2026-03-15T14:00:00Z",
      locationId: "t-loc-regents-park",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-07T08:00:00Z",  // after LAST_LOGIN → "new"
      lastUpdated: "2026-03-07T08:00:00Z",
      recurrenceType: "weekly",
      recurrenceEndDate: "2026-06-30T23:59:59Z",
      skillLevel: "All levels",
      eventCategory: "jam",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 2. CLASS — Beginner — PAID + concession — No recurrence — upcoming
    {
      id: "t-evt-beginner-class",
      title: "[TEST] Beginner AcroYoga Class",
      description: "A 2-hour introduction covering bird, throne, and basic washing machines. No partner required — we rotate throughout. Mats provided.",
      dateTime: "2026-03-22T10:00:00Z",
      endDateTime: "2026-03-22T12:00:00Z",
      locationId: "t-loc-gym-brixton",
      status: "approved",
      createdBy: "user-alice",
      dateAdded: "2026-02-16T08:00:00Z",
      lastUpdated: "2026-03-06T10:00:00Z",  // after LAST_LOGIN → "updated"
      recurrenceType: "none",
      skillLevel: "Beginner",
      eventCategory: "class",
      prerequisites: null,
      costAmount: 15,
      costCurrency: "GBP",
      concessionAmount: 10,
      maxAttendees: 12,
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 3. WORKSHOP — Intermediate — PAID — No concession — FULL (maxAttendees reached)
    {
      id: "t-evt-full-workshop",
      title: "[TEST] Friday Flow Workshop (FULL)",
      description: "Intermediate flows and standing acro. Warm-up included. Mats provided. This event is fully booked — demonstrating the 'Full' badge.",
      dateTime: "2026-04-03T18:30:00Z",
      endDateTime: "2026-04-03T21:00:00Z",
      locationId: "t-loc-colombo",
      status: "approved",
      createdBy: "user-alice",
      dateAdded: "2026-02-17T08:00:00Z",
      lastUpdated: "2026-02-17T08:00:00Z",
      recurrenceType: "none",
      skillLevel: "Intermediate",
      prerequisites: "• Comfortable holding bird pose for 10 seconds\n• Confident base in basic L-basing",
      costAmount: 8,
      costCurrency: "GBP",
      maxAttendees: 2,  // only 2 spots → seeded with 2 RSVPs below → full
      eventCategory: "workshop",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 4. WORKSHOP — Advanced — PAID + concession — No recurrence — upcoming
    {
      id: "t-evt-advanced-workshop",
      title: "[TEST] Washing Machine Masterclass (Advanced)",
      description: "Deep dive into washing machine transitions — icarian, whip, and reverse flows. Detailed prerequisites required.",
      dateTime: "2026-04-11T14:00:00Z",
      endDateTime: "2026-04-11T17:00:00Z",
      locationId: "t-loc-laban",
      status: "approved",
      createdBy: "user-alice",
      dateAdded: "2026-02-18T08:00:00Z",
      lastUpdated: "2026-02-18T08:00:00Z",
      recurrenceType: "none",
      skillLevel: "Advanced",
      prerequisites: "• Solid washing machine foundation (pop to Star)\n• Confident in icarian entry and exit\n• Able to safely spot a flying partner",
      costAmount: 25,
      costCurrency: "GBP",
      concessionAmount: 18,
      maxAttendees: 16,
      eventCategory: "workshop",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 5. FESTIVAL — All levels — PAID + concession — No recurrence — upcoming (NEW)
    {
      id: "t-evt-spring-festival",
      title: "[TEST] Spring AcroYoga Festival",
      description: "All-day festival with workshops, jams, and performances. Multiple teachers. All levels welcome! This is a multi-day event group — demonstrates group/ticket UI.",
      dateTime: "2026-05-16T10:00:00Z",
      endDateTime: "2026-05-16T20:00:00Z",
      locationId: "t-loc-victoria-park",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-08T09:00:00Z",  // after LAST_LOGIN → "new"
      lastUpdated: "2026-03-08T09:00:00Z",
      recurrenceType: "none",
      skillLevel: "All levels",
      eventCategory: "festival",
      costAmount: 45,
      costCurrency: "GBP",
      concessionAmount: 30,
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 6. JAM — All levels — FREE — PAST (demonstrates past event styling)
    {
      id: "t-evt-past-jam",
      title: "[TEST] Past Winter Jam (Jan 2026)",
      description: "A cosy winter jam. Great fun was had — looking forward to the next one! This event is in the past.",
      dateTime: "2026-01-18T11:00:00Z",
      endDateTime: "2026-01-18T14:00:00Z",
      locationId: "t-loc-gym-brixton",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-01-10T08:00:00Z",
      lastUpdated: "2026-01-10T08:00:00Z",
      recurrenceType: "none",
      skillLevel: "All levels",
      eventCategory: "jam",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 7. CLASS — Intermediate — FREE — Monthly recurring — upcoming (UPDATED)
    {
      id: "t-evt-monthly-class",
      title: "[TEST] Monthly Intermediate Class",
      description: "Monthly deep-dive into intermediate techniques. Focuses on a different theme each month. This month: therapeutic flying.",
      dateTime: "2026-04-05T14:00:00Z",
      endDateTime: "2026-04-05T16:30:00Z",
      locationId: "t-loc-laban",
      status: "approved",
      createdBy: "user-alice",
      dateAdded: "2026-01-20T08:00:00Z",
      lastUpdated: "2026-03-06T10:00:00Z",  // after LAST_LOGIN → "updated"
      recurrenceType: "monthly",
      recurrenceEndDate: "2026-12-31T23:59:59Z",
      skillLevel: "Intermediate",
      eventCategory: "class",
      costAmount: 12,
      costCurrency: "GBP",
      concessionAmount: 8,
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 8. STATUS: PENDING — admin needs to approve
    {
      id: "t-evt-pending",
      title: "[TEST] Pending Approval Workshop",
      description: "This event is pending admin approval. It should only appear in the admin queue and not in the public events list.",
      dateTime: "2026-04-20T10:00:00Z",
      endDateTime: "2026-04-20T12:00:00Z",
      locationId: "t-loc-gym-brixton",
      status: "pending",
      createdBy: "user-bob",
      dateAdded: "2026-03-08T12:00:00Z",
      lastUpdated: "2026-03-08T12:00:00Z",
      recurrenceType: "none",
      skillLevel: "Beginner",
      eventCategory: "workshop",
      costAmount: 10,
      costCurrency: "GBP",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 9. STATUS: REJECTED
    {
      id: "t-evt-rejected",
      title: "[TEST] Rejected Event (should not appear publicly)",
      description: "This event was rejected by an admin. It should not appear in the public events list.",
      dateTime: "2026-04-25T10:00:00Z",
      endDateTime: "2026-04-25T12:00:00Z",
      locationId: "t-loc-colombo",
      status: "rejected",
      createdBy: "user-bob",
      dateAdded: "2026-03-01T08:00:00Z",
      lastUpdated: "2026-03-03T09:00:00Z",
      recurrenceType: "none",
      skillLevel: "All levels",
      eventCategory: "jam",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 10. EXTERNAL EVENT — All levels — with poster and booking URL
    {
      id: "t-evt-external",
      title: "[TEST] External Festival (external booking)",
      description: "An externally-run festival. Click 'Book externally' to reserve your place on the organiser's website. In-app 'going' RSVP still works.",
      dateTime: "2026-05-02T09:00:00Z",
      endDateTime: "2026-05-02T18:00:00Z",
      locationId: "t-loc-victoria-park",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-01T10:00:00Z",
      lastUpdated: "2026-03-01T10:00:00Z",
      recurrenceType: "none",
      skillLevel: "All levels",
      eventCategory: "festival",
      costAmount: 60,
      costCurrency: "GBP",
      concessionAmount: 40,
      isExternal: true,
      externalUrl: "https://example.com/external-festival-booking",
      posterUrl: null,
    },

    // ────────────────────────────────────────────────────
    // 11. New York — JAM — All levels — FREE — Weekly recurring
    {
      id: "t-evt-ny-jam",
      title: "[TEST] Central Park AcroYoga Jam (NYC)",
      description: "Weekly open jam on the Great Lawn. All levels, bring a mat. We'll be near the Delacorte Theater.",
      dateTime: "2026-03-22T14:00:00Z",
      endDateTime: "2026-03-22T17:00:00Z",
      locationId: "t-loc-central-park",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-02T08:00:00Z",
      lastUpdated: "2026-03-02T08:00:00Z",
      recurrenceType: "weekly",
      recurrenceEndDate: "2026-07-01T23:59:59Z",
      skillLevel: "All levels",
      eventCategory: "jam",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 12. New York — WORKSHOP — Beginner — PAID USD
    {
      id: "t-evt-ny-beginner",
      title: "[TEST] NYC Intro to AcroYoga Workshop",
      description: "First time? Perfect. Learn bird, throne, and basic safety. Partners rotated. No experience needed. Priced in USD.",
      dateTime: "2026-04-05T11:00:00Z",
      endDateTime: "2026-04-05T13:00:00Z",
      locationId: "t-loc-central-park",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-02T08:30:00Z",
      lastUpdated: "2026-03-02T08:30:00Z",
      recurrenceType: "none",
      skillLevel: "Beginner",
      eventCategory: "workshop",
      costAmount: 20,
      costCurrency: "USD",
      concessionAmount: 12,
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 13. New York — FESTIVAL — All levels — Paid USD
    {
      id: "t-evt-ny-festival",
      title: "[TEST] NYC Spring AcroYoga Festival",
      description: "All-day festival with workshops, jams, and performances. Multiple teachers. All levels welcome!",
      dateTime: "2026-04-19T10:00:00Z",
      endDateTime: "2026-04-19T18:00:00Z",
      locationId: "t-loc-prospect-park",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-03T10:00:00Z",
      lastUpdated: "2026-03-03T10:00:00Z",
      recurrenceType: "none",
      skillLevel: "All levels",
      eventCategory: "festival",
      costAmount: 45,
      costCurrency: "USD",
      concessionAmount: 30,
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 14. Paris — CLASS — Intermediate — EUR — Weekly
    {
      id: "t-evt-paris-class",
      title: "[TEST] Cours AcroYoga Intermédiaire (Paris)",
      description: "Cours hebdomadaire en plein air au Trocadéro. Niveau intermédiaire. Vue sur la Tour Eiffel ! Weekly outdoor class near the Eiffel Tower.",
      dateTime: "2026-03-21T11:00:00Z",
      endDateTime: "2026-03-21T13:00:00Z",
      locationId: "t-loc-trocadero",
      status: "approved",
      createdBy: "user-emma",
      dateAdded: "2026-03-01T09:00:00Z",
      lastUpdated: "2026-03-01T09:00:00Z",
      recurrenceType: "weekly",
      recurrenceEndDate: "2026-06-30T23:59:59Z",
      skillLevel: "Intermediate",
      eventCategory: "class",
      costAmount: 12,
      costCurrency: "EUR",
      concessionAmount: 8,
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 15. Paris — JAM — All levels — FREE
    {
      id: "t-evt-paris-jam",
      title: "[TEST] Paris Acro Jam — Belleville",
      description: "Free open jam in Parc de Belleville. All levels, great city views. Bring a mat!",
      dateTime: "2026-04-12T14:00:00Z",
      endDateTime: "2026-04-12T17:00:00Z",
      locationId: "t-loc-parc-belleville",
      status: "approved",
      createdBy: "user-emma",
      dateAdded: "2026-03-01T09:30:00Z",
      lastUpdated: "2026-03-07T09:00:00Z",  // after LAST_LOGIN → "updated"
      recurrenceType: "none",
      skillLevel: "All levels",
      eventCategory: "jam",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 16. Berlin — JAM — All levels — FREE
    {
      id: "t-evt-berlin-jam",
      title: "[TEST] Tiergarten AcroYoga Jam (Berlin)",
      description: "Outdoor jam in the iconic Tiergarten park. All levels welcome. Meet at the Siegessäule.",
      dateTime: "2026-04-18T12:00:00Z",
      endDateTime: "2026-04-18T15:00:00Z",
      locationId: "t-loc-tiergarten",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-04T10:00:00Z",
      lastUpdated: "2026-03-04T10:00:00Z",
      recurrenceType: "none",
      skillLevel: "All levels",
      eventCategory: "jam",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 17. Sydney — WORKSHOP — Beginner — AUD
    {
      id: "t-evt-sydney-workshop",
      title: "[TEST] Bondi Beach AcroYoga Workshop (Sydney)",
      description: "Beginner workshop on the grass near Bondi Beach. Soft landing guaranteed! AUD pricing example.",
      dateTime: "2026-04-26T09:00:00Z",
      endDateTime: "2026-04-26T11:30:00Z",
      locationId: "t-loc-bondi-beach",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-05T11:00:00Z",
      lastUpdated: "2026-03-05T11:00:00Z",
      recurrenceType: "none",
      skillLevel: "Beginner",
      eventCategory: "workshop",
      costAmount: 25,
      costCurrency: "AUD",
      concessionAmount: 18,
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 18. Bristol — JAM — weekly
    {
      id: "t-evt-bristol-jam",
      title: "[TEST] Bristol Castle Park Jam",
      description: "Friendly open jam in Castle Park. All levels, just bring a mat and a smile.",
      dateTime: "2026-03-23T11:00:00Z",
      endDateTime: "2026-03-23T14:00:00Z",
      locationId: "t-loc-castle-park",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-03T11:00:00Z",
      lastUpdated: "2026-03-03T11:00:00Z",
      recurrenceType: "weekly",
      recurrenceEndDate: "2026-05-31T23:59:59Z",
      skillLevel: "All levels",
      eventCategory: "jam",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 19. CLASS — All levels — No cost — Daily recurring (short demo)
    {
      id: "t-evt-daily-practice",
      title: "[TEST] Daily Morning Practice (Daily Recurrence Demo)",
      description: "Short daily morning practice session. This event demonstrates daily recurrence. Each occurrence is 30 minutes.",
      dateTime: "2026-03-15T07:00:00Z",
      endDateTime: "2026-03-15T07:30:00Z",
      locationId: "t-loc-regents-park",
      status: "approved",
      createdBy: "user-alice",
      dateAdded: "2026-03-08T06:00:00Z",  // after LAST_LOGIN → "new"
      lastUpdated: "2026-03-08T06:00:00Z",
      recurrenceType: "daily",
      recurrenceEndDate: "2026-03-31T23:59:59Z",
      skillLevel: "All levels",
      eventCategory: "class",
      isExternal: false,
    },

    // ────────────────────────────────────────────────────
    // 20. WORKSHOP — No max attendees — Intermediate — CAD
    {
      id: "t-evt-no-cap-workshop",
      title: "[TEST] Open-Capacity Workshop (No Attendee Limit)",
      description: "A workshop with no attendee cap — demonstrates that Full badge doesn't appear. Priced in CAD.",
      dateTime: "2026-05-09T13:00:00Z",
      endDateTime: "2026-05-09T15:00:00Z",
      locationId: "t-loc-colombo",
      status: "approved",
      createdBy: "user-alice",
      dateAdded: "2026-02-20T08:00:00Z",
      lastUpdated: "2026-02-20T08:00:00Z",
      recurrenceType: "none",
      skillLevel: "Intermediate",
      eventCategory: "workshop",
      costAmount: 18,
      costCurrency: "CAD",
      concessionAmount: 12,
      maxAttendees: null,
      isExternal: false,
    },
  ]).onConflictDoNothing();

  // ── RSVPs ─────────────────────────────────────────────────────────────
  // Include various role mixes, show/hide name, teaching flags, payment statuses.
  await db.insert(rsvps).values([
    // Weekly jam — mixed roles, some show name, one teacher
    { eventId: "t-evt-weekly-jam", userId: "user-alice", role: "Base",   showName: true,  isTeaching: true,  paymentStatus: null },
    { eventId: "t-evt-weekly-jam", userId: "user-bob",   role: "Flyer",  showName: true,  isTeaching: false, paymentStatus: null },
    { eventId: "t-evt-weekly-jam", userId: "user-carol", role: "Hybrid", showName: false, isTeaching: false, paymentStatus: null },

    // Beginner class — paid RSVPs
    { eventId: "t-evt-beginner-class", userId: "user-alice", role: "Base",  showName: true, isTeaching: true,  paymentStatus: "full" },
    { eventId: "t-evt-beginner-class", userId: "user-bob",   role: "Flyer", showName: true, isTeaching: false, paymentStatus: "concession" },
    { eventId: "t-evt-beginner-class", userId: "user-carol", role: "Base",  showName: true, isTeaching: false, paymentStatus: null },

    // Full workshop — exactly maxAttendees (2) so it shows as full
    { eventId: "t-evt-full-workshop", userId: "user-alice", role: "Base",  showName: true, isTeaching: false, paymentStatus: "full" },
    { eventId: "t-evt-full-workshop", userId: "user-bob",   role: "Flyer", showName: true, isTeaching: false, paymentStatus: "full" },

    // Advanced workshop — one RSVP, show-name = false
    { eventId: "t-evt-advanced-workshop", userId: "user-alice", role: "Flyer", showName: false, isTeaching: false, paymentStatus: null },

    // Monthly class — only dan RSVP'd
    { eventId: "t-evt-monthly-class", userId: "user-dan", role: "Base", showName: false, isTeaching: false, paymentStatus: "full" },

    // Paris class — multi-role, international
    { eventId: "t-evt-paris-class", userId: "user-emma",  role: "Base",   showName: true, isTeaching: true,  paymentStatus: "full" },
    { eventId: "t-evt-paris-class", userId: "user-carol", role: "Flyer",  showName: true, isTeaching: false, paymentStatus: null },

    // External event — "going" RSVP (no ticket)
    { eventId: "t-evt-external", userId: "user-alice", role: "Hybrid", showName: true, isTeaching: false, paymentStatus: null },
    { eventId: "t-evt-external", userId: "user-dan",   role: "Base",   showName: true, isTeaching: false, paymentStatus: null },

    // NYC jam — base + flyer
    { eventId: "t-evt-ny-jam", userId: "user-bob",   role: "Base",  showName: true,  isTeaching: false, paymentStatus: null },
    { eventId: "t-evt-ny-jam", userId: "user-carol", role: "Flyer", showName: false, isTeaching: false, paymentStatus: null },

    // Past jam — shows past attendees
    { eventId: "t-evt-past-jam", userId: "user-alice", role: "Base",  showName: true, isTeaching: false, paymentStatus: null },
    { eventId: "t-evt-past-jam", userId: "user-bob",   role: "Flyer", showName: true, isTeaching: false, paymentStatus: null },
    { eventId: "t-evt-past-jam", userId: "user-dan",   role: "Hybrid",showName: true, isTeaching: false, paymentStatus: null },
  ]).onConflictDoNothing();

  // ── Event Interests ───────────────────────────────────────────────────
  await db.insert(eventInterests).values([
    { eventId: "t-evt-spring-festival",  userId: "user-alice", createdAt: "2026-03-08T10:00:00Z" },
    { eventId: "t-evt-spring-festival",  userId: "user-bob",   createdAt: "2026-03-08T11:00:00Z" },
    { eventId: "t-evt-spring-festival",  userId: "user-carol", createdAt: "2026-03-08T12:00:00Z" },
    { eventId: "t-evt-advanced-workshop",userId: "user-bob",   createdAt: "2026-03-06T09:00:00Z" },
    { eventId: "t-evt-ny-festival",      userId: "user-dan",   createdAt: "2026-03-05T10:00:00Z" },
  ]).onConflictDoNothing();

  // ── Event Group + Tickets (Festival) ─────────────────────────────────
  // Demonstrates the group/ticket/booking UI.
  await db.insert(eventGroups).values([
    {
      id: "t-grp-spring-festival",
      name: "[TEST] Spring AcroYoga Festival 2026",
      description: "A two-day acro festival with morning jams, afternoon workshops, and an evening flow show.",
      type: "festival",
      status: "published",
      createdBy: "user-dan",
      createdAt: "2026-03-08T09:00:00Z",
      updatedAt: "2026-03-08T09:00:00Z",
    },
  ]).onConflictDoNothing();

  // Add spring festival and an extra day-2 event to the group
  await db.insert(events).values([
    {
      id: "t-evt-spring-festival-day2",
      title: "[TEST] Spring AcroYoga Festival — Day 2",
      description: "Day 2: advanced workshops, partner work, and evening performance. Part of the Spring Festival group.",
      dateTime: "2026-05-17T10:00:00Z",
      endDateTime: "2026-05-17T20:00:00Z",
      locationId: "t-loc-victoria-park",
      status: "approved",
      createdBy: "user-dan",
      dateAdded: "2026-03-08T09:00:00Z",
      lastUpdated: "2026-03-08T09:00:00Z",
      recurrenceType: "none",
      skillLevel: "Intermediate",
      eventCategory: "festival",
      costAmount: 45,
      costCurrency: "GBP",
      concessionAmount: 30,
      isExternal: false,
    },
  ]).onConflictDoNothing();

  await db.insert(eventGroupMembers).values([
    { groupId: "t-grp-spring-festival", eventId: "t-evt-spring-festival",      sortOrder: 1 },
    { groupId: "t-grp-spring-festival", eventId: "t-evt-spring-festival-day2", sortOrder: 2 },
  ]).onConflictDoNothing();

  await db.insert(ticketTypes).values([
    {
      id: "t-tt-weekend-pass",
      groupId: "t-grp-spring-festival",
      name: "Weekend Pass (both days)",
      description: "Access to all workshops and jams across both days.",
      costAmount: 75,
      costCurrency: "GBP",
      concessionAmount: 55,
      capacity: 40,
      isAvailable: true,
      sortOrder: 1,
      createdAt: "2026-03-08T09:00:00Z",
      updatedAt: "2026-03-08T09:00:00Z",
    },
    {
      id: "t-tt-day1-pass",
      groupId: "t-grp-spring-festival",
      name: "Day 1 Pass",
      description: "Access to Day 1 events only.",
      costAmount: 45,
      costCurrency: "GBP",
      concessionAmount: 30,
      capacity: 60,
      isAvailable: true,
      sortOrder: 2,
      createdAt: "2026-03-08T09:00:00Z",
      updatedAt: "2026-03-08T09:00:00Z",
    },
    {
      id: "t-tt-day2-pass",
      groupId: "t-grp-spring-festival",
      name: "Day 2 Pass",
      description: "Access to Day 2 events only.",
      costAmount: 45,
      costCurrency: "GBP",
      concessionAmount: 30,
      capacity: 60,
      isAvailable: true,
      sortOrder: 3,
      createdAt: "2026-03-08T09:00:00Z",
      updatedAt: "2026-03-08T09:00:00Z",
    },
  ]).onConflictDoNothing();

  console.log("Test seed complete.");
  await testPool.end();
}

seed().catch((err) => {
  console.error("Test seed failed:", err);
  process.exit(1);
});

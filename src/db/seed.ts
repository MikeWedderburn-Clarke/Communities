/**
 * Seed script for local development.
 * Requires PostgreSQL to be running and migrations applied first:
 *   npm run db:migrate
 *   npm run db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { db, pool } from "./index";
import { users, locations, events, rsvps } from "./schema";

async function seed() {
  // ── Users ────────────────────────────────────────────────────────
  await db.insert(users).values([
    {
      id: "user-alice", name: "Alice Johnson", email: "alice@example.com",
      isAdmin: false, isTeacherApproved: true,
      teacherRequestedAt: "2026-01-01T00:00:00Z", teacherApprovedBy: "user-dan",
      defaultRole: "Base", defaultShowName: true,
      facebookUrl: "https://facebook.com/alicejohnson", instagramUrl: "https://instagram.com/alice_acro",
      websiteUrl: null, youtubeUrl: null,
      homeCity: null, useCurrentLocation: false,
      lastLogin: "2026-03-05T08:00:00Z", previousLogin: "2026-02-22T00:00:00Z",
    },
    {
      id: "user-bob", name: "Bob Smith", email: "bob@example.com",
      isAdmin: false, isTeacherApproved: false,
      teacherRequestedAt: "2026-02-20T00:00:00Z", teacherApprovedBy: null,
      defaultRole: "Flyer", defaultShowName: true,
      facebookUrl: null, instagramUrl: "https://instagram.com/bob_flies",
      websiteUrl: null, youtubeUrl: null,
      homeCity: null, useCurrentLocation: false,
      lastLogin: "2026-03-02T10:30:00Z", previousLogin: "2026-02-22T00:00:00Z",
    },
    {
      id: "user-carol", name: "Carol Williams", email: "carol@example.com",
      isAdmin: false, isTeacherApproved: false,
      teacherRequestedAt: null, teacherApprovedBy: null,
      defaultRole: null, defaultShowName: null,
      facebookUrl: null, instagramUrl: null,
      websiteUrl: null, youtubeUrl: null,
      homeCity: null, useCurrentLocation: false,
      lastLogin: null, previousLogin: null,
    },
    {
      id: "user-dan", name: "Dan Brown", email: "dan@example.com",
      isAdmin: true, isTeacherApproved: false,
      teacherRequestedAt: null, teacherApprovedBy: null,
      defaultRole: "Flyer", defaultShowName: false,
      facebookUrl: null, instagramUrl: null,
      websiteUrl: "https://danbrown-acro.com", youtubeUrl: null,
      homeCity: null, useCurrentLocation: false,
      lastLogin: "2026-03-04T09:45:00Z", previousLogin: "2026-02-22T00:00:00Z",
    },
  ]).onConflictDoNothing();

  // ── Locations ────────────────────────────────────────────────────
  await db.insert(locations).values([
    { id: "loc-regents-park", name: "Regent's Park", city: "London", country: "United Kingdom", latitude: 51.5273, longitude: -0.1535, what3names: "gently.snowy.magic", howToFind: "Meet near the bandstand by the cafe.", createdBy: "user-dan" },
    { id: "loc-gym-brixton", name: "The Gym Group Brixton", city: "London", country: "United Kingdom", latitude: 51.4613, longitude: -0.1150, what3names: "bench.crossing.now", howToFind: "Enter through the main gym on Brixton Hill.", createdBy: "user-dan" },
    { id: "loc-colombo", name: "Colombo Centre, Elephant & Castle", city: "London", country: "United Kingdom", latitude: 51.4946, longitude: -0.1008, what3names: null, howToFind: null, createdBy: "user-dan" },
    { id: "loc-laban", name: "Laban Dance Centre, Greenwich", city: "London", country: "United Kingdom", latitude: 51.4741, longitude: -0.0143, what3names: null, howToFind: null, createdBy: "user-dan" },
    { id: "loc-victoria-park", name: "Victoria Park, Hackney", city: "London", country: "United Kingdom", latitude: 51.5368, longitude: -0.0396, what3names: null, howToFind: null, createdBy: "user-dan" },
    { id: "loc-central-park", name: "Central Park Great Lawn", city: "New York", country: "United States", latitude: 40.7812, longitude: -73.9665, what3names: "open.perfect.lawn", howToFind: "Meet near the Delacorte Theater steps.", createdBy: "user-dan" },
    { id: "loc-prospect-park", name: "Prospect Park Long Meadow", city: "New York", country: "United States", latitude: 40.6602, longitude: -73.9690, what3names: null, howToFind: null, createdBy: "user-dan" },
    { id: "loc-domino-park", name: "Domino Park, Williamsburg", city: "New York", country: "United States", latitude: 40.7135, longitude: -73.9683, what3names: null, howToFind: null, createdBy: "user-dan" },
    { id: "loc-castle-park", name: "Castle Park", city: "Bristol", country: "United Kingdom", latitude: 51.4530, longitude: -2.5900, what3names: null, howToFind: null, createdBy: "user-dan" },
    { id: "loc-the-motion", name: "The Motion", city: "Bristol", country: "United Kingdom", latitude: 51.4490, longitude: -2.5830, what3names: null, howToFind: null, createdBy: "user-dan" },
    { id: "loc-boscombe-beach", name: "Boscombe Beach", city: "Bournemouth", country: "United Kingdom", latitude: 50.7198, longitude: -1.8400, what3names: null, howToFind: null, createdBy: "user-dan" },
    { id: "loc-shelley-park", name: "Shelley Park", city: "Bournemouth", country: "United Kingdom", latitude: 50.7220, longitude: -1.8530, what3names: null, howToFind: null, createdBy: "user-dan" },
  ]).onConflictDoNothing();

  // ── Events ───────────────────────────────────────────────────────
  await db.insert(events).values([
    {
      id: "evt-sunday-jam", title: "Sunday AcroYoga Jam",
      description: "Open-level jam in Regent's Park. Bring a mat and good vibes! All levels welcome.",
      dateTime: "2026-03-08T11:00:00Z", endDateTime: "2026-03-08T14:00:00Z",
      locationId: "loc-regents-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-02-15T08:00:00Z", lastUpdated: "2026-03-01T09:00:00Z",
      recurrenceType: "weekly", recurrenceEndDate: "2026-06-30T23:59:59Z",
      skillLevel: "All levels", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-beginner-workshop", title: "Beginner AcroYoga Workshop",
      description: "A 2-hour introduction to AcroYoga covering bird, throne, and basic washing machines. No partner required — we rotate throughout.",
      dateTime: "2026-03-14T10:00:00Z", endDateTime: "2026-03-14T12:00:00Z",
      locationId: "loc-gym-brixton", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-02-16T08:00:00Z", lastUpdated: "2026-03-07T10:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "Beginner", prerequisites: null, costAmount: 15, costCurrency: "GBP", concessionAmount: 10, maxAttendees: 12,
    },
    {
      id: "evt-flight-night", title: "Friday Flight Night",
      description: "Weekly evening session focused on intermediate flows and standing acro. Warm-up included. Mats provided.",
      dateTime: "2026-03-20T18:30:00Z", endDateTime: "2026-03-20T21:00:00Z",
      locationId: "loc-colombo", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-02-17T08:00:00Z", lastUpdated: "2026-03-04T10:30:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "Intermediate", prerequisites: "• Comfortable holding bird pose for 10 seconds\n• Confident base in basic L-basing",
      costAmount: 8, costCurrency: "GBP", concessionAmount: null, maxAttendees: 8,
    },
    {
      id: "evt-washing-machine", title: "Washing Machine Masterclass",
      description: "Deep dive into washing machine transitions — icarian, whip, and reverse flows. Intermediate level recommended.",
      dateTime: "2026-03-28T14:00:00Z", endDateTime: "2026-03-28T17:00:00Z",
      locationId: "loc-laban", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-02-18T08:00:00Z", lastUpdated: "2026-03-06T11:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "Advanced", prerequisites: "• Solid washing machine foundation (pop to Star)\n• Confident in icarian entry and exit\n• Able to safely spot a flying partner",
      costAmount: 25, costCurrency: "GBP", concessionAmount: 18, maxAttendees: 16,
    },
    {
      id: "evt-park-jam-april", title: "Spring Park Jam",
      description: "Celebrating the warmer weather with a big outdoor jam. All levels, family-friendly. We'll have a dedicated beginners' circle.",
      dateTime: "2026-04-05T12:00:00Z", endDateTime: "2026-04-05T16:00:00Z",
      locationId: "loc-victoria-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-02-20T08:00:00Z", lastUpdated: "2026-03-02T08:30:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "All levels", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-ny-central-park-jam", title: "Central Park AcroYoga Jam",
      description: "Weekly open jam on the Great Lawn. All levels, bring a mat. We'll be near the Delacorte Theater.",
      dateTime: "2026-03-15T14:00:00Z", endDateTime: "2026-03-15T17:00:00Z",
      locationId: "loc-central-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-02T08:00:00Z", lastUpdated: "2026-03-15T09:00:00Z",
      recurrenceType: "weekly", recurrenceEndDate: "2026-07-01T23:59:59Z",
      skillLevel: "All levels", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-ny-beginner-intro", title: "NYC Beginner Intro to AcroYoga",
      description: "First time? Perfect. Learn bird, throne, and basic safety. Partners rotated throughout. No experience needed.",
      dateTime: "2026-03-22T11:00:00Z", endDateTime: "2026-03-22T13:00:00Z",
      locationId: "loc-central-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-02T08:30:00Z", lastUpdated: "2026-03-15T09:30:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "Beginner", prerequisites: null, costAmount: 20, costCurrency: "USD", concessionAmount: 12, maxAttendees: null,
    },
    {
      id: "evt-ny-prospect-flow", title: "Prospect Park Flow Session",
      description: "Intermediate flow practice — washing machines, whips, and pops. Meet at the Long Meadow south entrance.",
      dateTime: "2026-03-29T10:00:00Z", endDateTime: "2026-03-29T12:30:00Z",
      locationId: "loc-prospect-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-02T09:00:00Z", lastUpdated: "2026-03-15T10:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "Intermediate", prerequisites: "• At least 3 months of regular AcroYoga practice\n• Comfortable in bird and star",
      costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-ny-domino-sunset", title: "Sunset Acro at Domino Park",
      description: "Evening session with Manhattan skyline views. Standing acro and L-basing. Intermediate level.",
      dateTime: "2026-04-04T17:30:00Z", endDateTime: "2026-04-04T20:00:00Z",
      locationId: "loc-domino-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-03T09:30:00Z", lastUpdated: "2026-03-16T18:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "Intermediate", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-ny-spring-festival", title: "NYC Spring AcroYoga Festival",
      description: "All-day festival with workshops, jams, and performances. Multiple teachers. All levels welcome!",
      dateTime: "2026-04-12T10:00:00Z", endDateTime: "2026-04-12T18:00:00Z",
      locationId: "loc-prospect-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-03T10:00:00Z", lastUpdated: "2026-03-16T12:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "All levels", prerequisites: null, costAmount: 45, costCurrency: "USD", concessionAmount: 30, maxAttendees: null,
    },
    {
      id: "evt-bristol-castle-jam", title: "Bristol Castle Park Jam",
      description: "Friendly open jam in Castle Park. All levels, just bring a mat and a smile.",
      dateTime: "2026-03-16T11:00:00Z", endDateTime: "2026-03-16T14:00:00Z",
      locationId: "loc-castle-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-03T11:00:00Z", lastUpdated: "2026-03-04T12:00:00Z",
      recurrenceType: "weekly", recurrenceEndDate: "2026-05-31T23:59:59Z",
      skillLevel: "All levels", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-bristol-motion-workshop", title: "Bristol Intermediate Workshop",
      description: "Two-hour workshop at The Motion covering intermediate flows, pops, and icarian. Some experience recommended.",
      dateTime: "2026-03-23T14:00:00Z", endDateTime: "2026-03-23T16:00:00Z",
      locationId: "loc-the-motion", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-03T11:30:00Z", lastUpdated: "2026-03-04T12:30:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "Intermediate", prerequisites: "• Able to hold a stable bird as base or flyer\n• Comfortable with basic washing machine",
      costAmount: 12, costCurrency: "GBP", concessionAmount: 8, maxAttendees: null,
    },
    {
      id: "evt-bristol-spring-jam", title: "Bristol Spring Outdoor Jam",
      description: "Welcoming the spring sunshine with an outdoor session. Beginners corner available. Bring snacks to share!",
      dateTime: "2026-04-06T12:00:00Z", endDateTime: "2026-04-06T15:00:00Z",
      locationId: "loc-castle-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-03T12:00:00Z", lastUpdated: "2026-03-04T13:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "All levels", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-demo-new", title: "Laban New Arrivals Session",
      description: "Brand-new event added this week. Open to all levels. Come and meet the new faces joining the community.",
      dateTime: "2026-04-07T19:00:00Z", endDateTime: "2026-04-07T21:00:00Z",
      locationId: "loc-laban", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-01T09:00:00Z", lastUpdated: "2026-03-01T09:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "All levels", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-demo-updated", title: "Victoria Park Updated Jam",
      description: "This event was recently updated with a new time and location details. Check the latest info before attending.",
      dateTime: "2026-04-14T10:00:00Z", endDateTime: "2026-04-14T13:00:00Z",
      locationId: "loc-victoria-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-01-20T08:00:00Z", lastUpdated: "2026-03-03T11:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "Intermediate", prerequisites: "• Comfortable in bird and star",
      costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-demo-full", title: "Colombo Sold-Out Workshop",
      description: "This intimate workshop is now fully booked. Join the waitlist on the event page and we may open more spots.",
      dateTime: "2026-04-10T18:30:00Z", endDateTime: "2026-04-10T20:30:00Z",
      locationId: "loc-colombo", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-02-10T08:00:00Z", lastUpdated: "2026-02-10T08:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "Intermediate", prerequisites: null, costAmount: 10, costCurrency: "GBP", concessionAmount: 7, maxAttendees: 2,
    },
    {
      id: "evt-demo-past", title: "Brixton Winter Jam",
      description: "A cosy winter jam at The Gym Group Brixton. Great fun was had — looking forward to the next one!",
      dateTime: "2026-01-20T11:00:00Z", endDateTime: "2026-01-20T14:00:00Z",
      locationId: "loc-gym-brixton", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-01-10T08:00:00Z", lastUpdated: "2026-01-10T08:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "All levels", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-bournemouth-beach-acro", title: "Boscombe Beach AcroYoga",
      description: "AcroYoga on the sand! Soft landing guaranteed. All levels. Meet by the pier at 10am.",
      dateTime: "2026-03-21T10:00:00Z", endDateTime: "2026-03-21T13:00:00Z",
      locationId: "loc-boscombe-beach", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-05T11:00:00Z", lastUpdated: "2026-03-06T12:00:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "All levels", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
    {
      id: "evt-bournemouth-park-session", title: "Shelley Park Sunday Session",
      description: "Relaxed Sunday practice in Shelley Park. Bring a mat, water, and sunscreen. All abilities welcome.",
      dateTime: "2026-04-13T11:00:00Z", endDateTime: "2026-04-13T14:00:00Z",
      locationId: "loc-shelley-park", status: "approved", createdBy: "user-dan",
      dateAdded: "2026-03-05T11:30:00Z", lastUpdated: "2026-03-06T12:30:00Z",
      recurrenceType: "none", recurrenceEndDate: null,
      skillLevel: "All levels", prerequisites: null, costAmount: null, costCurrency: null, concessionAmount: null, maxAttendees: null,
    },
  ]).onConflictDoNothing();

  // ── RSVPs ────────────────────────────────────────────────────────
  await db.insert(rsvps).values([
    { eventId: "evt-sunday-jam",        userId: "user-alice", role: "Base",   showName: true,  isTeaching: true,  paymentStatus: null },
    { eventId: "evt-sunday-jam",        userId: "user-bob",   role: "Flyer",  showName: true,  isTeaching: false, paymentStatus: null },
    { eventId: "evt-sunday-jam",        userId: "user-carol", role: "Hybrid", showName: false, isTeaching: false, paymentStatus: null },
    { eventId: "evt-beginner-workshop", userId: "user-alice", role: "Base",   showName: true,  isTeaching: true,  paymentStatus: null },
    { eventId: "evt-beginner-workshop", userId: "user-dan",   role: "Flyer",  showName: true,  isTeaching: false, paymentStatus: null },
    { eventId: "evt-flight-night",      userId: "user-bob",   role: "Hybrid", showName: true,  isTeaching: false, paymentStatus: null },
    { eventId: "evt-flight-night",      userId: "user-carol", role: "Base",   showName: true,  isTeaching: false, paymentStatus: null },
    { eventId: "evt-flight-night",      userId: "user-dan",   role: "Flyer",  showName: false, isTeaching: false, paymentStatus: null },
    { eventId: "evt-washing-machine",   userId: "user-alice", role: "Flyer",  showName: true,  isTeaching: false, paymentStatus: null },
    { eventId: "evt-demo-full",         userId: "user-alice", role: "Base",   showName: true,  isTeaching: false, paymentStatus: null },
    { eventId: "evt-demo-full",         userId: "user-bob",   role: "Flyer",  showName: true,  isTeaching: false, paymentStatus: null },
  ]).onConflictDoNothing();

  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

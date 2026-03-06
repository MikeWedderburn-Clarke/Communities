import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, resetDb } from "@/db/test-utils";
import {
  createEvent,
  getAllEvents,
  getEventDetail,
  toggleInterest,
  getUserInterestSet,
  getInterestCounts,
  getEventInterestInfo,
  approveEvent,
} from "@/services/events";
import * as schema from "@/db/schema";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function seedTestData(db: TestDb) {
  await db.insert(schema.users).values([
    { id: "u1", name: "Alice", email: "alice@test.com", isAdmin: false },
    { id: "u2", name: "Bob", email: "bob@test.com", isAdmin: false },
    { id: "u3", name: "Carol", email: "carol@test.com", isAdmin: false },
    { id: "u-admin", name: "Dan", email: "dan@test.com", isAdmin: true },
  ]);

  await db.insert(schema.locations).values({
    id: "loc-test",
    name: "Test Venue",
    city: "London",
    country: "United Kingdom",
    latitude: 51.5074,
    longitude: -0.1278,
  });

  // Pre-seed two approved events for interest tests
  await db.insert(schema.events).values([
    {
      id: "e1",
      title: "Internal Jam",
      description: "A regular jam",
      dateTime: "2026-05-01T10:00:00Z",
      endDateTime: "2026-05-01T12:00:00Z",
      locationId: "loc-test",
      status: "approved",
      dateAdded: "2026-02-01T10:00:00Z",
      lastUpdated: "2026-02-01T10:00:00Z",
      eventCategory: "jam",
      isExternal: false,
    },
    {
      id: "e2",
      title: "External Workshop",
      description: "A workshop with external booking",
      dateTime: "2026-06-01T10:00:00Z",
      endDateTime: "2026-06-01T17:00:00Z",
      locationId: "loc-test",
      status: "approved",
      dateAdded: "2026-02-01T10:00:00Z",
      lastUpdated: "2026-02-01T10:00:00Z",
      eventCategory: "workshop",
      isExternal: true,
      externalUrl: "https://example.com/book",
      posterUrl: "https://example.com/poster.jpg",
    },
  ]);
}

// ── Interest toggle tests ──────────────────────────────────────────────

describe("interest toggle", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedTestData(db);
  });

  it("marks a user as interested", async () => {
    const result = await toggleInterest(db, "u1", "e1");
    expect(result.interested).toBe(true);
  });

  it("toggles interest off on second call", async () => {
    await toggleInterest(db, "u1", "e1");
    const result = await toggleInterest(db, "u1", "e1");
    expect(result.interested).toBe(false);
  });

  it("toggles interest back on after third call", async () => {
    await toggleInterest(db, "u1", "e1");
    await toggleInterest(db, "u1", "e1");
    const result = await toggleInterest(db, "u1", "e1");
    expect(result.interested).toBe(true);
  });

  it("different users can independently mark interest", async () => {
    await toggleInterest(db, "u1", "e1");
    await toggleInterest(db, "u2", "e1");

    const set1 = await getUserInterestSet(db, "u1");
    const set2 = await getUserInterestSet(db, "u2");
    expect(set1.has("e1")).toBe(true);
    expect(set2.has("e1")).toBe(true);
  });

  it("toggling off for one user does not affect another", async () => {
    await toggleInterest(db, "u1", "e1");
    await toggleInterest(db, "u2", "e1");
    await toggleInterest(db, "u1", "e1"); // u1 removes interest

    const set1 = await getUserInterestSet(db, "u1");
    const set2 = await getUserInterestSet(db, "u2");
    expect(set1.has("e1")).toBe(false);
    expect(set2.has("e1")).toBe(true);
  });

  it("interest works on both internal and external events", async () => {
    const r1 = await toggleInterest(db, "u1", "e1"); // internal
    const r2 = await toggleInterest(db, "u1", "e2"); // external
    expect(r1.interested).toBe(true);
    expect(r2.interested).toBe(true);

    const set = await getUserInterestSet(db, "u1");
    expect(set.has("e1")).toBe(true);
    expect(set.has("e2")).toBe(true);
  });
});

// ── getUserInterestSet tests ───────────────────────────────────────────

describe("getUserInterestSet", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedTestData(db);
  });

  it("returns empty set when user has no interests", async () => {
    const set = await getUserInterestSet(db, "u1");
    expect(set.size).toBe(0);
  });

  it("returns correct set of event IDs", async () => {
    await toggleInterest(db, "u1", "e1");
    await toggleInterest(db, "u1", "e2");

    const set = await getUserInterestSet(db, "u1");
    expect(set.size).toBe(2);
    expect(set.has("e1")).toBe(true);
    expect(set.has("e2")).toBe(true);
  });

  it("does not include events from other users", async () => {
    await toggleInterest(db, "u2", "e1");

    const set = await getUserInterestSet(db, "u1");
    expect(set.size).toBe(0);
  });
});

// ── getInterestCounts tests ────────────────────────────────────────────

describe("getInterestCounts", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedTestData(db);
  });

  it("returns empty object for empty event list", async () => {
    const counts = await getInterestCounts(db, []);
    expect(counts).toEqual({});
  });

  it("returns zero counts when no one is interested", async () => {
    const counts = await getInterestCounts(db, ["e1", "e2"]);
    expect(counts["e1"]).toBeUndefined();
    expect(counts["e2"]).toBeUndefined();
  });

  it("returns correct counts with multiple interested users", async () => {
    await toggleInterest(db, "u1", "e1");
    await toggleInterest(db, "u2", "e1");
    await toggleInterest(db, "u3", "e1");
    await toggleInterest(db, "u1", "e2");

    const counts = await getInterestCounts(db, ["e1", "e2"]);
    expect(counts["e1"]).toBe(3);
    expect(counts["e2"]).toBe(1);
  });

  it("does not count toggled-off interests", async () => {
    await toggleInterest(db, "u1", "e1");
    await toggleInterest(db, "u2", "e1");
    await toggleInterest(db, "u1", "e1"); // u1 removes interest

    const counts = await getInterestCounts(db, ["e1"]);
    expect(counts["e1"]).toBe(1);
  });
});

// ── getEventInterestInfo tests ─────────────────────────────────────────

describe("getEventInterestInfo", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedTestData(db);
  });

  it("returns zero count and not interested for anonymous user", async () => {
    const info = await getEventInterestInfo(db, "e1", null);
    expect(info.interestedCount).toBe(0);
    expect(info.isInterested).toBe(false);
  });

  it("returns zero count and not interested when no one is interested", async () => {
    const info = await getEventInterestInfo(db, "e1", "u1");
    expect(info.interestedCount).toBe(0);
    expect(info.isInterested).toBe(false);
  });

  it("returns correct count and isInterested=true for interested user", async () => {
    await toggleInterest(db, "u1", "e1");
    await toggleInterest(db, "u2", "e1");

    const info = await getEventInterestInfo(db, "e1", "u1");
    expect(info.interestedCount).toBe(2);
    expect(info.isInterested).toBe(true);
  });

  it("returns correct count and isInterested=false for non-interested user", async () => {
    await toggleInterest(db, "u1", "e1");
    await toggleInterest(db, "u2", "e1");

    const info = await getEventInterestInfo(db, "e1", "u3");
    expect(info.interestedCount).toBe(2);
    expect(info.isInterested).toBe(false);
  });

  it("returns correct count for anonymous when others are interested", async () => {
    await toggleInterest(db, "u1", "e1");

    const info = await getEventInterestInfo(db, "e1", null);
    expect(info.interestedCount).toBe(1);
    expect(info.isInterested).toBe(false);
  });
});

// ── External event creation and retrieval ──────────────────────────────

describe("external event creation", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedTestData(db);
  });

  const baseInput = {
    title: "External Festival",
    description: "A big festival",
    dateTime: "2026-07-01T10:00:00Z",
    endDateTime: "2026-07-01T22:00:00Z",
    locationId: "loc-test",
    recurrence: null,
    skillLevel: "All levels" as const,
    prerequisites: null,
    costAmount: 50,
    costCurrency: "GBP",
    concessionAmount: 30,
    maxAttendees: null,
    eventCategory: "festival" as const,
    isExternal: true,
    externalUrl: "https://example.com/festival",
    posterUrl: "https://example.com/festival-poster.jpg",
  };

  it("persists external event fields in the database", async () => {
    const id = await createEvent(db, baseInput, "u-admin", true);
    const [row] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, id))
      .limit(1);

    expect(row?.eventCategory).toBe("festival");
    expect(row?.isExternal).toBe(true);
    expect(row?.externalUrl).toBe("https://example.com/festival");
    expect(row?.posterUrl).toBe("https://example.com/festival-poster.jpg");
  });

  it("external events appear in getAllEvents with correct fields", async () => {
    const id = await createEvent(db, baseInput, "u-admin", true);
    const events = await getAllEvents(db);
    const event = events.find((e) => e.id === id);

    expect(event).toBeDefined();
    expect(event!.eventCategory).toBe("festival");
    expect(event!.isExternal).toBe(true);
    expect(event!.externalUrl).toBe("https://example.com/festival");
    expect(event!.posterUrl).toBe("https://example.com/festival-poster.jpg");
  });

  it("external events appear in getEventDetail with correct fields", async () => {
    const id = await createEvent(db, baseInput, "u-admin", true);
    const detail = await getEventDetail(db, id, "u1", false);

    expect(detail).not.toBeNull();
    expect(detail!.eventCategory).toBe("festival");
    expect(detail!.isExternal).toBe(true);
    expect(detail!.externalUrl).toBe("https://example.com/festival");
    expect(detail!.posterUrl).toBe("https://example.com/festival-poster.jpg");
  });

  it("internal events have isExternal=false and null external fields", async () => {
    const internalInput = {
      ...baseInput,
      title: "Internal Class",
      eventCategory: "class" as const,
      isExternal: false,
      externalUrl: null,
      posterUrl: null,
    };
    const id = await createEvent(db, internalInput, "u-admin", true);
    const events = await getAllEvents(db);
    const event = events.find((e) => e.id === id);

    expect(event).toBeDefined();
    expect(event!.eventCategory).toBe("class");
    expect(event!.isExternal).toBe(false);
    expect(event!.externalUrl).toBeNull();
    expect(event!.posterUrl).toBeNull();
  });

  it("event category defaults to 'class' for pre-seeded events without explicit category", async () => {
    // e1 was seeded with eventCategory: "jam"
    const events = await getAllEvents(db);
    const e1 = events.find((e) => e.id === "e1");
    expect(e1!.eventCategory).toBe("jam");
  });

  it("pre-seeded external event has correct external fields", async () => {
    const events = await getAllEvents(db);
    const e2 = events.find((e) => e.id === "e2");
    expect(e2!.isExternal).toBe(true);
    expect(e2!.externalUrl).toBe("https://example.com/book");
    expect(e2!.posterUrl).toBe("https://example.com/poster.jpg");
  });
});

// ── Event category in listings ─────────────────────────────────────────

describe("event category in listings", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedTestData(db);
  });

  it("getAllEvents returns eventCategory for each event", async () => {
    const events = await getAllEvents(db);
    for (const e of events) {
      expect(["festival", "workshop", "class", "jam"]).toContain(e.eventCategory);
    }
  });

  it("different events can have different categories", async () => {
    const events = await getAllEvents(db);
    const categories = new Set(events.map((e) => e.eventCategory));
    // e1 is "jam", e2 is "workshop"
    expect(categories.has("jam")).toBe(true);
    expect(categories.has("workshop")).toBe(true);
  });
});

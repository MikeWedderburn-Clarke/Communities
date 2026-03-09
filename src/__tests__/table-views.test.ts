import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb, resetDb } from "@/db/test-utils";
import * as schema from "@/db/schema";
import { getAllUsers } from "@/services/users";
import { getAllLocationsWithCreatedBy } from "@/services/locations";
import { getAllEventsRaw } from "@/services/events";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function seedData(db: TestDb) {
  await db.insert(schema.users).values([
    {
      id: "u1",
      name: "Alice Admin",
      email: "alice@test.com",
      isAdmin: true,
      isTeacherApproved: true,
      profileVisibility: "everyone",
      previousLogin: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "u2",
      name: "Bob Public",
      email: "bob@test.com",
      isAdmin: false,
      profileVisibility: "everyone",
    },
    {
      id: "u3",
      name: "Carol Private",
      email: "carol@test.com",
      isAdmin: false,
      profileVisibility: "followers",
    },
  ]);

  await db.insert(schema.locations).values([
    {
      id: "loc1",
      name: "Community Hall",
      city: "London",
      country: "UK",
      latitude: 51.5,
      longitude: -0.1,
      createdBy: "u1",
    },
    {
      id: "loc2",
      name: "Park",
      city: "Paris",
      country: "France",
      latitude: 48.8,
      longitude: 2.3,
    },
  ]);

  await db.insert(schema.events).values([
    {
      id: "evt1",
      title: "Morning Jam",
      description: "A fun jam",
      dateTime: "2025-06-01T10:00:00.000Z",
      endDateTime: "2025-06-01T12:00:00.000Z",
      locationId: "loc1",
      status: "approved",
      createdBy: "u1",
      dateAdded: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-01T00:00:00.000Z",
      recurrenceType: "none",
      skillLevel: "All levels",
      eventCategory: "jam",
    },
    {
      id: "evt2",
      title: "Advanced Workshop",
      description: "For advanced practitioners",
      dateTime: "2025-07-10T14:00:00.000Z",
      endDateTime: "2025-07-10T17:00:00.000Z",
      locationId: "loc2",
      status: "pending",
      createdBy: "u2",
      dateAdded: "2025-02-01T00:00:00.000Z",
      lastUpdated: "2025-02-01T00:00:00.000Z",
      recurrenceType: "weekly",
      skillLevel: "Advanced",
      eventCategory: "workshop",
      costAmount: 15,
      costCurrency: "GBP",
    },
  ]);
}

describe("getAllUsers", () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await (db as any).$pglite?.close(); });
  beforeEach(async () => { await resetDb(db); await seedData(db); });

  it("admin sees all users including private ones", async () => {
    const users = await getAllUsers(db, true);
    expect(users).toHaveLength(3);
    const ids = users.map((u) => u.id);
    expect(ids).toContain("u1");
    expect(ids).toContain("u2");
    expect(ids).toContain("u3");
  });

  it("admin sees email and previousLogin", async () => {
    const users = await getAllUsers(db, true);
    const alice = users.find((u) => u.id === "u1")!;
    expect(alice.email).toBe("alice@test.com");
    expect(alice.previousLogin).toBe("2024-01-01T00:00:00.000Z");
  });

  it("non-admin only sees users with profileVisibility=everyone", async () => {
    const users = await getAllUsers(db, false);
    expect(users).toHaveLength(2);
    const ids = users.map((u) => u.id);
    expect(ids).toContain("u1");
    expect(ids).toContain("u2");
    expect(ids).not.toContain("u3");
  });

  it("non-admin does not see email, teacherApprovedBy, or previousLogin", async () => {
    const users = await getAllUsers(db, false);
    const alice = users.find((u) => u.id === "u1")!;
    expect(alice.email).toBeNull();
    expect(alice.teacherApprovedBy).toBeNull();
    expect(alice.previousLogin).toBeNull();
  });

  it("returns rows sorted by name", async () => {
    const users = await getAllUsers(db, true);
    const names = users.map((u) => u.name);
    expect(names).toEqual([...names].sort());
  });
});

describe("getAllLocationsWithCreatedBy", () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await (db as any).$pglite?.close(); });
  beforeEach(async () => { await resetDb(db); await seedData(db); });

  it("returns all locations", async () => {
    const locs = await getAllLocationsWithCreatedBy(db);
    expect(locs).toHaveLength(2);
  });

  it("populates createdByName when user exists", async () => {
    const locs = await getAllLocationsWithCreatedBy(db);
    const hall = locs.find((l) => l.id === "loc1")!;
    expect(hall.createdBy).toBe("u1");
    expect(hall.createdByName).toBe("Alice Admin");
  });

  it("createdByName is null when no creator", async () => {
    const locs = await getAllLocationsWithCreatedBy(db);
    const park = locs.find((l) => l.id === "loc2")!;
    expect(park.createdBy).toBeNull();
    expect(park.createdByName).toBeNull();
  });

  it("returns all location fields", async () => {
    const locs = await getAllLocationsWithCreatedBy(db);
    const hall = locs.find((l) => l.id === "loc1")!;
    expect(hall.name).toBe("Community Hall");
    expect(hall.city).toBe("London");
    expect(hall.country).toBe("UK");
    expect(hall.latitude).toBe(51.5);
    expect(hall.longitude).toBe(-0.1);
  });
});

describe("getAllEventsRaw", () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await (db as any).$pglite?.close(); });
  beforeEach(async () => { await resetDb(db); await seedData(db); });

  it("returns all events regardless of status", async () => {
    const events = await getAllEventsRaw(db);
    expect(events).toHaveLength(2);
    const statuses = events.map((e) => e.status);
    expect(statuses).toContain("approved");
    expect(statuses).toContain("pending");
  });

  it("includes location name", async () => {
    const events = await getAllEventsRaw(db);
    const jam = events.find((e) => e.id === "evt1")!;
    expect(jam.locationName).toBe("Community Hall");
  });

  it("includes creator name", async () => {
    const events = await getAllEventsRaw(db);
    const jam = events.find((e) => e.id === "evt1")!;
    expect(jam.createdByName).toBe("Alice Admin");
  });

  it("createdByName is null when creator not set", async () => {
    // Insert event with no createdBy
    await db.insert(schema.events).values({
      id: "evt3",
      title: "Orphan Event",
      description: "No creator",
      dateTime: "2025-08-01T10:00:00.000Z",
      endDateTime: "2025-08-01T12:00:00.000Z",
      locationId: "loc1",
      status: "approved",
      dateAdded: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-01T00:00:00.000Z",
      recurrenceType: "none",
      skillLevel: "All levels",
      eventCategory: "jam",
    });
    const events = await getAllEventsRaw(db);
    const orphan = events.find((e) => e.id === "evt3")!;
    expect(orphan.createdByName).toBeNull();
    expect(orphan.createdBy).toBeNull();
  });

  it("maps all event fields correctly", async () => {
    const events = await getAllEventsRaw(db);
    const workshop = events.find((e) => e.id === "evt2")!;
    expect(workshop.title).toBe("Advanced Workshop");
    expect(workshop.recurrenceType).toBe("weekly");
    expect(workshop.skillLevel).toBe("Advanced");
    expect(workshop.costAmount).toBe(15);
    expect(workshop.costCurrency).toBe("GBP");
    expect(workshop.eventCategory).toBe("workshop");
  });
});

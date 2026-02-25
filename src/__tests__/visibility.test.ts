import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/db/test-utils";
import {
  getEventDetail,
  createOrUpdateRsvp,
  deleteRsvp,
  getAllEvents,
} from "@/services/events";
import * as schema from "@/db/schema";

type TestDb = ReturnType<typeof createTestDb>;

function seedTestData(db: TestDb) {
  db.insert(schema.users).values([
    { id: "u1", name: "Alice", email: "alice@test.com" },
    { id: "u2", name: "Bob", email: "bob@test.com" },
    { id: "u3", name: "Carol", email: "carol@test.com" },
  ]).run();

  db.insert(schema.events).values({
    id: "e1",
    title: "Test Jam",
    description: "A test event",
    dateTime: "2026-03-08T11:00:00Z",
    endDateTime: "2026-03-08T14:00:00Z",
    location: "London",
  }).run();
}

describe("event detail visibility rules", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
    seedTestData(db);
  });

  it("does NOT expose names to anonymous users", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    await createOrUpdateRsvp(db, "u2", "e1", "Flyer", true);

    const detail = await getEventDetail(db, "e1", null);
    expect(detail).not.toBeNull();
    expect(detail!.visibleAttendees).toEqual([]);
    // But counts are still public
    expect(detail!.attendeeCount).toBe(2);
    expect(detail!.roleCounts.Base).toBe(1);
    expect(detail!.roleCounts.Flyer).toBe(1);
  });

  it("exposes names only for showName=true to logged-in users", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);  // Alice: visible
    await createOrUpdateRsvp(db, "u2", "e1", "Flyer", false); // Bob: hidden
    await createOrUpdateRsvp(db, "u3", "e1", "Spotter", true); // Carol: visible

    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.visibleAttendees).toHaveLength(2);
    const names = detail!.visibleAttendees.map((a) => a.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Carol");
    expect(names).not.toContain("Bob");
  });

  it("never exposes email addresses in event detail", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);

    const detail = await getEventDetail(db, "e1", "u1");
    const json = JSON.stringify(detail);
    expect(json).not.toContain("alice@test.com");
    expect(json).not.toContain("bob@test.com");
    expect(json).not.toContain("email");
  });

  it("returns currentUserRsvp for the logged-in user", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Hybrid", true);

    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.currentUserRsvp).toEqual({ role: "Hybrid", showName: true });
  });

  it("returns null currentUserRsvp when user has not RSVP'd", async () => {
    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.currentUserRsvp).toBeNull();
  });

  it("returns null for non-existent event", async () => {
    const detail = await getEventDetail(db, "nonexistent", null);
    expect(detail).toBeNull();
  });
});

describe("RSVP create/update/delete", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
    seedTestData(db);
  });

  it("creates an RSVP", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.attendeeCount).toBe(1);
    expect(detail!.currentUserRsvp).toEqual({ role: "Base", showName: true });
  });

  it("updates an existing RSVP (role change)", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    await createOrUpdateRsvp(db, "u1", "e1", "Flyer", false);
    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.attendeeCount).toBe(1); // still 1, not 2
    expect(detail!.currentUserRsvp).toEqual({ role: "Flyer", showName: false });
  });

  it("deletes an RSVP", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    const deleted = await deleteRsvp(db, "u1", "e1");
    expect(deleted).toBe(true);
    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.attendeeCount).toBe(0);
    expect(detail!.currentUserRsvp).toBeNull();
  });

  it("returns false when deleting non-existent RSVP", async () => {
    const deleted = await deleteRsvp(db, "u1", "e1");
    expect(deleted).toBe(false);
  });
});

describe("role aggregation in event list", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
    seedTestData(db);
  });

  it("shows correct role counts in event summary", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    await createOrUpdateRsvp(db, "u2", "e1", "Base", true);
    await createOrUpdateRsvp(db, "u3", "e1", "Flyer", false);

    const events = await getAllEvents(db);
    const event = events.find((e) => e.id === "e1");
    expect(event).toBeDefined();
    expect(event!.attendeeCount).toBe(3);
    expect(event!.roleCounts).toEqual({
      Base: 2,
      Flyer: 1,
      Hybrid: 0,
      Spotter: 0,
    });
  });

  it("event summary never contains names or emails", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    const events = await getAllEvents(db);
    const json = JSON.stringify(events);
    expect(json).not.toContain("Alice");
    expect(json).not.toContain("alice@test.com");
    expect(json).not.toContain("email");
  });
});

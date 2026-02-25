import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-utils";
import {
  getEventDetail,
  createOrUpdateRsvp,
  deleteRsvp,
  getAllEvents,
  requestTeacherStatus,
  getPendingTeacherRequests,
  approveTeacher,
  denyTeacher,
} from "@/services/events";
import * as schema from "@/db/schema";

type TestDb = ReturnType<typeof createTestDb>;

function seedTestData(db: TestDb) {
  db.insert(schema.users).values([
    { id: "u1", name: "Alice", email: "alice@test.com", isAdmin: false },
    { id: "u2", name: "Bob", email: "bob@test.com", isAdmin: false },
    { id: "u3", name: "Carol", email: "carol@test.com", isAdmin: false },
    { id: "u-admin", name: "Dan", email: "dan@test.com", isAdmin: true },
  ]).run();

  db.insert(schema.events).values({
    id: "e1",
    title: "Test Jam",
    description: "A test event",
    dateTime: "2026-03-08T11:00:00Z",
    endDateTime: "2026-03-08T14:00:00Z",
    location: "London",
    country: "United Kingdom",
    city: "London",
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

  it("exposes names only for showName=true to regular logged-in users", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);   // Alice: visible
    await createOrUpdateRsvp(db, "u2", "e1", "Flyer", false); // Bob: hidden
    await createOrUpdateRsvp(db, "u3", "e1", "Hybrid", true); // Carol: visible

    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.visibleAttendees).toHaveLength(2);
    const names = detail!.visibleAttendees.map((a) => a.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Carol");
    expect(names).not.toContain("Bob");
  });

  it("shows own hidden entry to the user themselves", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    await createOrUpdateRsvp(db, "u2", "e1", "Flyer", false); // Bob hides name

    // Viewing as Bob — should see Alice (public) + own entry with hidden=true
    const detail = await getEventDetail(db, "e1", "u2");
    expect(detail!.visibleAttendees).toHaveLength(2);
    const bob = detail!.visibleAttendees.find((a) => a.name === "Bob");
    expect(bob).toEqual({ userId: "u2", name: "Bob", role: "Flyer", hidden: true, isTeaching: false, socialLinks: {} });
    const alice = detail!.visibleAttendees.find((a) => a.name === "Alice");
    expect(alice).toEqual({ userId: "u1", name: "Alice", role: "Base", hidden: false, isTeaching: false, socialLinks: {} });
  });

  it("admin sees ALL attendees including hidden ones", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    await createOrUpdateRsvp(db, "u2", "e1", "Flyer", false);
    await createOrUpdateRsvp(db, "u3", "e1", "Hybrid", true);

    const detail = await getEventDetail(db, "e1", "u-admin", true);
    expect(detail!.visibleAttendees).toHaveLength(3);
    const names = detail!.visibleAttendees.map((a) => a.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
    expect(names).toContain("Carol");
  });

  it("admin sees hidden=true tag on showName=false attendees", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    await createOrUpdateRsvp(db, "u2", "e1", "Flyer", false);

    const detail = await getEventDetail(db, "e1", "u-admin", true);
    const bob = detail!.visibleAttendees.find((a) => a.name === "Bob");
    expect(bob).toEqual({ userId: "u2", name: "Bob", role: "Flyer", hidden: true, isTeaching: false, socialLinks: {} });
    const alice = detail!.visibleAttendees.find((a) => a.name === "Alice");
    expect(alice).toEqual({ userId: "u1", name: "Alice", role: "Base", hidden: false, isTeaching: false, socialLinks: {} });
  });

  it("never exposes email addresses in event detail", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);

    const detail = await getEventDetail(db, "e1", "u1");
    const json = JSON.stringify(detail);
    expect(json).not.toContain("alice@test.com");
    expect(json).not.toContain("bob@test.com");
    expect(json).not.toContain("email");
  });

  it("never exposes email addresses even for admin", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    await createOrUpdateRsvp(db, "u2", "e1", "Flyer", false);

    const detail = await getEventDetail(db, "e1", "u-admin", true);
    const json = JSON.stringify(detail);
    expect(json).not.toContain("alice@test.com");
    expect(json).not.toContain("bob@test.com");
    expect(json).not.toContain("dan@test.com");
    expect(json).not.toContain("email");
  });

  it("returns currentUserRsvp for the logged-in user", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Hybrid", true);

    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.currentUserRsvp).toEqual({ role: "Hybrid", showName: true, isTeaching: false });
  });

  it("returns null currentUserRsvp when user has not RSVP'd", async () => {
    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.currentUserRsvp).toBeNull();
  });

  it("returns null for non-existent event", async () => {
    const detail = await getEventDetail(db, "nonexistent", null);
    expect(detail).toBeNull();
  });

  it("visibleAttendees entries include userId field", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);

    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.visibleAttendees).toHaveLength(1);
    expect(detail!.visibleAttendees[0].userId).toBe("u1");
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
    expect(detail!.currentUserRsvp).toEqual({ role: "Base", showName: true, isTeaching: false });
  });

  it("updates an existing RSVP (role change)", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true);
    await createOrUpdateRsvp(db, "u1", "e1", "Flyer", false);
    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.attendeeCount).toBe(1); // still 1, not 2
    expect(detail!.currentUserRsvp).toEqual({ role: "Flyer", showName: false, isTeaching: false });
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

  it("creates RSVP with isTeaching=true", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true, true);
    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.currentUserRsvp).toEqual({ role: "Base", showName: true, isTeaching: true });
  });

  it("updates isTeaching flag on existing RSVP", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true, false);
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true, true);
    const detail = await getEventDetail(db, "e1", "u1");
    expect(detail!.currentUserRsvp).toEqual({ role: "Base", showName: true, isTeaching: true });
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

  it("shows correct teacherCount in event summary", async () => {
    await createOrUpdateRsvp(db, "u1", "e1", "Base", true, true);
    await createOrUpdateRsvp(db, "u2", "e1", "Flyer", true, false);
    await createOrUpdateRsvp(db, "u3", "e1", "Hybrid", true, true);

    const events = await getAllEvents(db);
    const event = events.find((e) => e.id === "e1");
    expect(event!.teacherCount).toBe(2);
  });
});

describe("teacher request/approval flow", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
    seedTestData(db);
  });

  it("creates a teacher request", async () => {
    await requestTeacherStatus(db, "u1");
    const pending = await getPendingTeacherRequests(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].userId).toBe("u1");
    expect(pending[0].userName).toBe("Alice");
    expect(pending[0].requestedAt).toBeTruthy();
  });

  it("approves a teacher request", async () => {
    await requestTeacherStatus(db, "u1");
    await approveTeacher(db, "u1", "u-admin");

    const pending = await getPendingTeacherRequests(db);
    expect(pending).toHaveLength(0);

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, "u1"))
      .limit(1);
    // Use direct DB query to verify approval
    expect(user.isTeacherApproved).toBe(true);
    expect(user.teacherApprovedBy).toBe("u-admin");
  });

  it("denies a teacher request", async () => {
    await requestTeacherStatus(db, "u2");
    await denyTeacher(db, "u2");

    const pending = await getPendingTeacherRequests(db);
    expect(pending).toHaveLength(0);

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, "u2"))
      .limit(1);
    expect(user.isTeacherApproved).toBe(false);
    expect(user.teacherRequestedAt).toBeNull();
  });

  it("only returns pending (not yet approved) requests", async () => {
    await requestTeacherStatus(db, "u1");
    await requestTeacherStatus(db, "u2");
    await approveTeacher(db, "u1", "u-admin");

    const pending = await getPendingTeacherRequests(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].userId).toBe("u2");
  });
});

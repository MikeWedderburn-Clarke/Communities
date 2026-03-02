import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb, resetDb } from "@/db/test-utils";
import * as schema from "@/db/schema";
import {
  createEventGroup,
  getEventGroupById,
  getEventGroupForEvent,
  addEventToGroup,
  removeEventFromGroup,
  publishEventGroup,
} from "@/services/event-groups";
import {
  createTicketType,
  getTicketTypesForEvent,
} from "@/services/ticket-types";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function seed(db: TestDb) {
  await db.insert(schema.users).values({ id: "u1", name: "Alice", email: "alice@test.com", isAdmin: true });
  await db.insert(schema.locations).values({
    id: "loc1", name: "Venue", city: "London", country: "UK", latitude: 51.5, longitude: -0.1,
  });
  await db.insert(schema.events).values([
    { id: "e1", title: "Day 1", description: "Fri", dateTime: "2026-08-01T12:00:00Z", endDateTime: "2026-08-01T20:00:00Z", locationId: "loc1", status: "approved", dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-01T00:00:00Z" },
    { id: "e2", title: "Day 2", description: "Sat", dateTime: "2026-08-02T12:00:00Z", endDateTime: "2026-08-02T20:00:00Z", locationId: "loc1", status: "approved", dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-01T00:00:00Z" },
  ]);
}

describe("event-groups service", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seed(db);
  });

  it("creates a group with draft status", async () => {
    const id = await createEventGroup(db, { name: "Summer Festival", description: null, type: "festival" }, "u1");
    const group = await getEventGroupById(db, id, true);
    expect(group).not.toBeNull();
    expect(group!.name).toBe("Summer Festival");
    expect(group!.status).toBe("draft");
    expect(group!.type).toBe("festival");
  });

  it("returns null for a draft group without includeUnpublished", async () => {
    const id = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    const group = await getEventGroupById(db, id, false);
    expect(group).toBeNull();
  });

  it("adds and removes events from a group", async () => {
    const id = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    await addEventToGroup(db, id, "e1", 0);
    await addEventToGroup(db, id, "e2", 1);

    const group = await getEventGroupById(db, id, true);
    expect(group!.memberEvents).toHaveLength(2);
    expect(group!.memberEvents.map((e) => e.eventId)).toContain("e1");

    await removeEventFromGroup(db, id, "e1");
    const updated = await getEventGroupById(db, id, true);
    expect(updated!.memberEvents).toHaveLength(1);
    expect(updated!.memberEvents[0].eventId).toBe("e2");
  });

  it("addEventToGroup is idempotent", async () => {
    const id = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    await addEventToGroup(db, id, "e1", 0);
    await addEventToGroup(db, id, "e1", 0); // duplicate — no error
    const group = await getEventGroupById(db, id, true);
    expect(group!.memberEvents).toHaveLength(1);
  });

  it("getEventGroupForEvent returns null for draft group without admin flag", async () => {
    const id = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    await addEventToGroup(db, id, "e1", 0);
    const result = await getEventGroupForEvent(db, "e1", false);
    expect(result).toBeNull();
  });

  it("getEventGroupForEvent returns draft group for admin", async () => {
    const id = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    await addEventToGroup(db, id, "e1", 0);
    const result = await getEventGroupForEvent(db, "e1", true);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
  });

  it("getEventGroupForEvent returns null when event is not in any group", async () => {
    const result = await getEventGroupForEvent(db, "e1", false);
    expect(result).toBeNull();
  });

  it("publishEventGroup throws when no available ticket types", async () => {
    const id = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    await expect(publishEventGroup(db, id)).rejects.toThrow("no available ticket types");
  });

  it("publishEventGroup succeeds with at least one available ticket type", async () => {
    const id = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    await addEventToGroup(db, id, "e1", 0);
    await createTicketType(db, {
      groupId: id, name: "Full Pass", description: null,
      costAmount: 80, costCurrency: "GBP", concessionAmount: null,
      capacity: 100, coveredEventIds: ["e1"], sortOrder: 0,
    });

    await publishEventGroup(db, id);
    const group = await getEventGroupById(db, id, false);
    expect(group).not.toBeNull();
    expect(group!.status).toBe("published");
  });
});

describe("getTicketTypesForEvent", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seed(db);
  });

  it("returns empty array when no ticket types cover the event", async () => {
    const types = await getTicketTypesForEvent(db, "e1");
    expect(types).toHaveLength(0);
  });

  it("returns ticket types covering the event with derived fields", async () => {
    const groupId = await createEventGroup(db, { name: "Combo", description: null, type: "combo" }, "u1");
    const ttId = await createTicketType(db, {
      groupId, name: "Full Pass", description: null,
      costAmount: 80, costCurrency: "GBP", concessionAmount: null,
      capacity: 10, coveredEventIds: ["e1", "e2"], sortOrder: 0,
    });

    const types = await getTicketTypesForEvent(db, "e1");
    expect(types).toHaveLength(1);
    const t = types[0];
    expect(t.id).toBe(ttId);
    expect(t.bookedCount).toBe(0);
    expect(t.isSoldOut).toBe(false);
    expect(t.coveredEventIds).toContain("e1");
    expect(t.coveredEventIds).toContain("e2");
  });

  it("does not return unavailable ticket types", async () => {
    const groupId = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    const ttId = await createTicketType(db, {
      groupId, name: "Day Pass", description: null,
      costAmount: 30, costCurrency: "GBP", concessionAmount: null,
      capacity: 20, coveredEventIds: ["e1"], sortOrder: 0,
    });
    // Manually deactivate
    await db.update(schema.ticketTypes)
      .set({ isAvailable: false })
      .where((await import("drizzle-orm")).eq(schema.ticketTypes.id, ttId));

    const types = await getTicketTypesForEvent(db, "e1");
    expect(types).toHaveLength(0);
  });

  it("isSoldOut is true when bookedCount equals capacity", async () => {
    const groupId = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    await createTicketType(db, {
      groupId, name: "Day Pass", description: null,
      costAmount: 30, costCurrency: "GBP", concessionAmount: null,
      capacity: 1, coveredEventIds: ["e1"], sortOrder: 0,
    });
    const [tt] = await (await getTicketTypesForEvent(db, "e1")) as any[];
    // Insert a booking directly to simulate sold out
    await db.insert(schema.bookings).values({
      id: "bk-test", userId: "u1", ticketTypeId: tt.id,
      showName: false, paymentStatus: "pending", bookedAt: new Date().toISOString(),
    });

    const types = await getTicketTypesForEvent(db, "e1");
    expect(types[0].isSoldOut).toBe(true);
    expect(types[0].bookedCount).toBe(1);
  });

  it("isSoldOut is false when capacity is null (unlimited)", async () => {
    const groupId = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    await createTicketType(db, {
      groupId, name: "Free Pass", description: null,
      costAmount: 0, costCurrency: "GBP", concessionAmount: null,
      capacity: null, coveredEventIds: ["e1"], sortOrder: 0,
    });

    const types = await getTicketTypesForEvent(db, "e1");
    expect(types[0].isSoldOut).toBe(false);
    expect(types[0].capacity).toBeNull();
  });

  it("refunded bookings do not count toward bookedCount", async () => {
    const groupId = await createEventGroup(db, { name: "Festival", description: null, type: "festival" }, "u1");
    await createTicketType(db, {
      groupId, name: "Day Pass", description: null,
      costAmount: 30, costCurrency: "GBP", concessionAmount: null,
      capacity: 5, coveredEventIds: ["e1"], sortOrder: 0,
    });
    const [tt] = await getTicketTypesForEvent(db, "e1");
    // Insert a refunded booking
    await db.insert(schema.bookings).values({
      id: "bk-test", userId: "u1", ticketTypeId: tt.id,
      showName: false, paymentStatus: "refunded", bookedAt: new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
    });

    const types = await getTicketTypesForEvent(db, "e1");
    expect(types[0].bookedCount).toBe(0);
    expect(types[0].isSoldOut).toBe(false);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb, resetDb } from "@/db/test-utils";
import * as schema from "@/db/schema";
import { createEventGroup } from "@/services/event-groups";
import { createTicketType } from "@/services/ticket-types";
import {
  createBooking,
  cancelBooking,
  getUserBookingForEvent,
  updateBookingPaymentStatus,
  isValidTransition,
} from "@/services/bookings";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function seedBase(db: TestDb) {
  await db.insert(schema.users).values([
    { id: "u1", name: "Alice", email: "alice@test.com", isAdmin: false },
    { id: "u2", name: "Bob", email: "bob@test.com", isAdmin: false },
  ]);
  await db.insert(schema.locations).values({
    id: "loc1", name: "Venue", city: "London", country: "UK", latitude: 51.5, longitude: -0.1,
  });
  await db.insert(schema.events).values({
    id: "e1", title: "Workshop", description: "Test", dateTime: "2026-08-01T10:00:00Z",
    endDateTime: "2026-08-01T12:00:00Z", locationId: "loc1", status: "approved",
    dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-01T00:00:00Z",
  });
}

async function seedGroup(db: TestDb, capacity: number | null = 2) {
  const groupId = await createEventGroup(db, { name: "Test Festival", description: null, type: "festival" }, "u1");
  const ttId = await createTicketType(db, {
    groupId, name: "Day Pass", description: null,
    costAmount: 30, costCurrency: "GBP", concessionAmount: null,
    capacity, coveredEventIds: ["e1"], sortOrder: 0,
  });
  return { groupId, ttId };
}

describe("isValidTransition", () => {
  it("allows pending → paid", () => expect(isValidTransition("pending", "paid")).toBe(true));
  it("allows pending → refunded", () => expect(isValidTransition("pending", "refunded")).toBe(true));
  it("allows paid → refunded", () => expect(isValidTransition("paid", "refunded")).toBe(true));
  it("disallows refunded → paid", () => expect(isValidTransition("refunded", "paid")).toBe(false));
  it("disallows paid → pending", () => expect(isValidTransition("paid", "pending")).toBe(false));
  it("disallows comp → pending", () => expect(isValidTransition("comp", "pending")).toBe(false));
});

describe("createBooking", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedBase(db);
  });

  it("creates a booking successfully", async () => {
    const { ttId } = await seedGroup(db, 5);
    const bookingId = await createBooking(db, "u1", { ticketTypeId: ttId, role: "Base", showName: true, isTeaching: false });
    expect(bookingId).toMatch(/^bk-/);

    const [booking] = await db.select().from(schema.bookings).where(
      (await import("drizzle-orm")).eq(schema.bookings.id, bookingId)
    );
    expect(booking.paymentStatus).toBe("pending");
    expect(booking.userId).toBe("u1");
  });

  it("throws 'sold out' when capacity is reached", async () => {
    const { ttId } = await seedGroup(db, 1);
    // Book the last slot
    await createBooking(db, "u1", { ticketTypeId: ttId, role: "Base", showName: false, isTeaching: false });
    // Second booking should fail
    await expect(
      createBooking(db, "u2", { ticketTypeId: ttId, role: "Flyer", showName: false, isTeaching: false })
    ).rejects.toThrow("sold out");
  });

  it("succeeds with unlimited capacity (null)", async () => {
    const { ttId } = await seedGroup(db, null);
    const b1 = await createBooking(db, "u1", { ticketTypeId: ttId, role: "Base", showName: false, isTeaching: false });
    const b2 = await createBooking(db, "u2", { ticketTypeId: ttId, role: "Flyer", showName: false, isTeaching: false });
    expect(b1).toMatch(/^bk-/);
    expect(b2).toMatch(/^bk-/);
  });

  it("throws when ticket type does not exist", async () => {
    await expect(
      createBooking(db, "u1", { ticketTypeId: "tt-nonexistent", role: null, showName: false, isTeaching: false })
    ).rejects.toThrow("not found");
  });

  it("throws when ticket type is unavailable", async () => {
    const { ttId } = await seedGroup(db, 10);
    await db.update(schema.ticketTypes)
      .set({ isAvailable: false })
      .where((await import("drizzle-orm")).eq(schema.ticketTypes.id, ttId));

    await expect(
      createBooking(db, "u1", { ticketTypeId: ttId, role: null, showName: false, isTeaching: false })
    ).rejects.toThrow("not currently available");
  });
});

describe("cancelBooking and re-booking", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedBase(db);
  });

  it("sets paymentStatus to refunded and sets cancelledAt", async () => {
    const { ttId } = await seedGroup(db, 5);
    const bookingId = await createBooking(db, "u1", { ticketTypeId: ttId, role: null, showName: false, isTeaching: false });
    await cancelBooking(db, bookingId);

    const [booking] = await db.select().from(schema.bookings).where(
      (await import("drizzle-orm")).eq(schema.bookings.id, bookingId)
    );
    expect(booking.paymentStatus).toBe("refunded");
    expect(booking.cancelledAt).not.toBeNull();
  });

  it("allows re-booking after a refund (partial unique index)", async () => {
    const { ttId } = await seedGroup(db, 1);
    const bookingId = await createBooking(db, "u1", { ticketTypeId: ttId, role: null, showName: false, isTeaching: false });
    await cancelBooking(db, bookingId);

    // Should succeed because the refunded booking is excluded from the partial index
    // NOTE: PGlite supports partial indexes so this should work
    const newBookingId = await createBooking(db, "u1", { ticketTypeId: ttId, role: null, showName: false, isTeaching: false });
    expect(newBookingId).toMatch(/^bk-/);
  });
});

describe("getUserBookingForEvent", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedBase(db);
  });

  it("returns null when user has no booking", async () => {
    const { ttId } = await seedGroup(db, 5);
    const booking = await getUserBookingForEvent(db, "u1", "e1");
    expect(booking).toBeNull();
  });

  it("returns the booking for an event covered by the ticket type", async () => {
    const { ttId } = await seedGroup(db, 5);
    const bookingId = await createBooking(db, "u1", { ticketTypeId: ttId, role: "Base", showName: true, isTeaching: false });
    const booking = await getUserBookingForEvent(db, "u1", "e1");
    expect(booking).not.toBeNull();
    expect(booking!.id).toBe(bookingId);
    expect(booking!.paymentStatus).toBe("pending");
  });

  it("returns null for refunded bookings", async () => {
    const { ttId } = await seedGroup(db, 5);
    const bookingId = await createBooking(db, "u1", { ticketTypeId: ttId, role: null, showName: false, isTeaching: false });
    await cancelBooking(db, bookingId);
    const booking = await getUserBookingForEvent(db, "u1", "e1");
    expect(booking).toBeNull();
  });
});

describe("updateBookingPaymentStatus", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seedBase(db);
  });

  it("transitions from pending to paid", async () => {
    const { ttId } = await seedGroup(db, 5);
    const bookingId = await createBooking(db, "u1", { ticketTypeId: ttId, role: null, showName: false, isTeaching: false });
    await updateBookingPaymentStatus(db, bookingId, { paymentStatus: "paid", amountPaid: 30, notes: "Cash" });

    const [booking] = await db.select().from(schema.bookings).where(
      (await import("drizzle-orm")).eq(schema.bookings.id, bookingId)
    );
    expect(booking.paymentStatus).toBe("paid");
    expect(booking.amountPaid).toBe(30);
    expect(booking.notes).toBe("Cash");
  });

  it("throws on invalid status transition", async () => {
    const { ttId } = await seedGroup(db, 5);
    const bookingId = await createBooking(db, "u1", { ticketTypeId: ttId, role: null, showName: false, isTeaching: false });
    await updateBookingPaymentStatus(db, bookingId, { paymentStatus: "paid", amountPaid: 30, notes: null });

    await expect(
      updateBookingPaymentStatus(db, bookingId, { paymentStatus: "pending", amountPaid: null, notes: null })
    ).rejects.toThrow('Cannot transition');
  });

  it("sets cancelledAt when transitioning to refunded", async () => {
    const { ttId } = await seedGroup(db, 5);
    const bookingId = await createBooking(db, "u1", { ticketTypeId: ttId, role: null, showName: false, isTeaching: false });
    await updateBookingPaymentStatus(db, bookingId, { paymentStatus: "refunded", amountPaid: null, notes: null });

    const [booking] = await db.select().from(schema.bookings).where(
      (await import("drizzle-orm")).eq(schema.bookings.id, bookingId)
    );
    expect(booking.cancelledAt).not.toBeNull();
  });
});

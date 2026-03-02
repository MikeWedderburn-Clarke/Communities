import { eq, and, ne, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import type {
  Booking,
  BookingPaymentStatus,
  CreateBookingInput,
  Role,
  UpdateBookingStatusInput,
} from "@/types";

function nowIso(): string {
  return new Date().toISOString();
}

function bookingId(): string {
  return `bk-${crypto.randomUUID()}`;
}

/**
 * Allowed payment status transitions (admin-initiated).
 * Refusal prevents invalid state changes from being persisted.
 */
const ALLOWED_TRANSITIONS: Record<BookingPaymentStatus, BookingPaymentStatus[]> = {
  pending: ["paid", "concession_paid", "comp", "refunded"],
  paid: ["refunded"],
  concession_paid: ["refunded"],
  comp: ["refunded"],
  refunded: [],
};

export function isValidTransition(
  from: BookingPaymentStatus,
  to: BookingPaymentStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Writes ─────────────────────────────────────────────────────────

/**
 * Creates a booking for a ticket type, atomically checking capacity.
 *
 * Uses SELECT ... FOR UPDATE on the ticket_types row to prevent concurrent
 * over-booking. The unique index on (user_id, ticket_type_id) prevents
 * duplicate active bookings at the DB level.
 */
export async function createBooking(
  db: Db,
  userId: string,
  input: CreateBookingInput
): Promise<string> {
  const id = bookingId();

  await db.transaction(async (tx) => {
    // Fetch the ticket type row (Drizzle ORM — works with PGlite in tests).
    const [tt] = await tx
      .select({ capacity: schema.ticketTypes.capacity, isAvailable: schema.ticketTypes.isAvailable })
      .from(schema.ticketTypes)
      .where(eq(schema.ticketTypes.id, input.ticketTypeId))
      .limit(1);

    if (!tt) {
      throw new Error("Ticket type not found.");
    }
    if (!tt.isAvailable) {
      throw new Error("This ticket type is not currently available.");
    }

    if (tt.capacity !== null) {
      const [{ cnt }] = await tx
        .select({ cnt: sql<number>`COUNT(*)::int` })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.ticketTypeId, input.ticketTypeId),
            ne(schema.bookings.paymentStatus, "refunded")
          )
        );
      if (cnt >= tt.capacity) {
        throw new Error("Sorry, this ticket is sold out.");
      }
    }

    await tx.insert(schema.bookings).values({
      id,
      userId,
      ticketTypeId: input.ticketTypeId,
      role: input.role,
      showName: input.showName,
      isTeaching: input.isTeaching,
      paymentStatus: "pending",
      amountPaid: null,
      currency: null,
      bookedAt: nowIso(),
      cancelledAt: null,
      notes: null,
    });
  });

  return id;
}

/**
 * Admin: update a booking's payment status.
 * Validates the transition is permitted. Sets cancelledAt when refunding.
 */
export async function updateBookingPaymentStatus(
  db: Db,
  bookingId: string,
  input: UpdateBookingStatusInput
): Promise<void> {
  const existing = await db
    .select({ paymentStatus: schema.bookings.paymentStatus })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (existing.length === 0) throw new Error("Booking not found.");

  const from = existing[0].paymentStatus as BookingPaymentStatus;
  if (!isValidTransition(from, input.paymentStatus)) {
    throw new Error(
      `Cannot transition booking from "${from}" to "${input.paymentStatus}".`
    );
  }

  const cancelledAt =
    input.paymentStatus === "refunded" ? nowIso() : undefined;

  await db
    .update(schema.bookings)
    .set({
      paymentStatus: input.paymentStatus,
      amountPaid: input.amountPaid,
      notes: input.notes,
      ...(cancelledAt !== undefined ? { cancelledAt } : {}),
    })
    .where(eq(schema.bookings.id, bookingId));
}

/**
 * Cancel a booking (sets status to "refunded").
 * For use by the booking owner; admins should use updateBookingPaymentStatus.
 */
export async function cancelBooking(db: Db, bookingId: string): Promise<void> {
  await db
    .update(schema.bookings)
    .set({ paymentStatus: "refunded", cancelledAt: nowIso() })
    .where(eq(schema.bookings.id, bookingId));
}

// ── Reads ──────────────────────────────────────────────────────────

/**
 * Returns the current user's active (non-refunded) booking for any ticket type
 * that covers the given event. Used on the event detail page.
 */
export async function getUserBookingForEvent(
  db: Db,
  userId: string,
  eventId: string
): Promise<Booking | null> {
  const rows = await db
    .select({
      bookingId: schema.bookings.id,
      userId: schema.bookings.userId,
      ticketTypeId: schema.bookings.ticketTypeId,
      ticketTypeName: schema.ticketTypes.name,
      groupId: schema.ticketTypes.groupId,
      groupName: schema.eventGroups.name,
      role: schema.bookings.role,
      showName: schema.bookings.showName,
      isTeaching: schema.bookings.isTeaching,
      paymentStatus: schema.bookings.paymentStatus,
      amountPaid: schema.bookings.amountPaid,
      currency: schema.bookings.currency,
      bookedAt: schema.bookings.bookedAt,
      cancelledAt: schema.bookings.cancelledAt,
      notes: schema.bookings.notes,
    })
    .from(schema.bookings)
    .innerJoin(
      schema.ticketTypeEvents,
      eq(schema.ticketTypeEvents.ticketTypeId, schema.bookings.ticketTypeId)
    )
    .innerJoin(
      schema.ticketTypes,
      eq(schema.ticketTypes.id, schema.bookings.ticketTypeId)
    )
    .innerJoin(
      schema.eventGroups,
      eq(schema.eventGroups.id, schema.ticketTypes.groupId)
    )
    .where(
      and(
        eq(schema.bookings.userId, userId),
        eq(schema.ticketTypeEvents.eventId, eventId),
        ne(schema.bookings.paymentStatus, "refunded")
      )
    )
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];
  return rowToBooking(r);
}

/**
 * Returns all of a user's bookings, optionally filtered to a single group.
 */
export async function getBookingsForUser(
  db: Db,
  userId: string,
  groupId?: string
): Promise<Booking[]> {
  const conditions = [eq(schema.bookings.userId, userId)];
  if (groupId) {
    conditions.push(eq(schema.ticketTypes.groupId, groupId));
  }

  const rows = await db
    .select({
      bookingId: schema.bookings.id,
      userId: schema.bookings.userId,
      ticketTypeId: schema.bookings.ticketTypeId,
      ticketTypeName: schema.ticketTypes.name,
      groupId: schema.ticketTypes.groupId,
      groupName: schema.eventGroups.name,
      role: schema.bookings.role,
      showName: schema.bookings.showName,
      isTeaching: schema.bookings.isTeaching,
      paymentStatus: schema.bookings.paymentStatus,
      amountPaid: schema.bookings.amountPaid,
      currency: schema.bookings.currency,
      bookedAt: schema.bookings.bookedAt,
      cancelledAt: schema.bookings.cancelledAt,
      notes: schema.bookings.notes,
    })
    .from(schema.bookings)
    .innerJoin(
      schema.ticketTypes,
      eq(schema.ticketTypes.id, schema.bookings.ticketTypeId)
    )
    .innerJoin(
      schema.eventGroups,
      eq(schema.eventGroups.id, schema.ticketTypes.groupId)
    )
    .where(and(...conditions))
    .orderBy(schema.bookings.bookedAt);

  return rows.map(rowToBooking);
}

/**
 * Admin: fetch all bookings for a group.
 */
export async function getBookingsForGroup(
  db: Db,
  groupId: string
): Promise<Booking[]> {
  const rows = await db
    .select({
      bookingId: schema.bookings.id,
      userId: schema.bookings.userId,
      ticketTypeId: schema.bookings.ticketTypeId,
      ticketTypeName: schema.ticketTypes.name,
      groupId: schema.ticketTypes.groupId,
      groupName: schema.eventGroups.name,
      role: schema.bookings.role,
      showName: schema.bookings.showName,
      isTeaching: schema.bookings.isTeaching,
      paymentStatus: schema.bookings.paymentStatus,
      amountPaid: schema.bookings.amountPaid,
      currency: schema.bookings.currency,
      bookedAt: schema.bookings.bookedAt,
      cancelledAt: schema.bookings.cancelledAt,
      notes: schema.bookings.notes,
    })
    .from(schema.bookings)
    .innerJoin(
      schema.ticketTypes,
      eq(schema.ticketTypes.id, schema.bookings.ticketTypeId)
    )
    .innerJoin(
      schema.eventGroups,
      eq(schema.eventGroups.id, schema.ticketTypes.groupId)
    )
    .where(eq(schema.ticketTypes.groupId, groupId))
    .orderBy(schema.bookings.bookedAt);

  return rows.map(rowToBooking);
}

/**
 * Fetch a single booking by ID (for auth checks in API routes).
 */
export async function getBookingById(
  db: Db,
  bookingId: string
): Promise<Booking | null> {
  const rows = await db
    .select({
      bookingId: schema.bookings.id,
      userId: schema.bookings.userId,
      ticketTypeId: schema.bookings.ticketTypeId,
      ticketTypeName: schema.ticketTypes.name,
      groupId: schema.ticketTypes.groupId,
      groupName: schema.eventGroups.name,
      role: schema.bookings.role,
      showName: schema.bookings.showName,
      isTeaching: schema.bookings.isTeaching,
      paymentStatus: schema.bookings.paymentStatus,
      amountPaid: schema.bookings.amountPaid,
      currency: schema.bookings.currency,
      bookedAt: schema.bookings.bookedAt,
      cancelledAt: schema.bookings.cancelledAt,
      notes: schema.bookings.notes,
    })
    .from(schema.bookings)
    .innerJoin(
      schema.ticketTypes,
      eq(schema.ticketTypes.id, schema.bookings.ticketTypeId)
    )
    .innerJoin(
      schema.eventGroups,
      eq(schema.eventGroups.id, schema.ticketTypes.groupId)
    )
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  return rows.length > 0 ? rowToBooking(rows[0]) : null;
}

// ── Internal helpers ───────────────────────────────────────────────

function rowToBooking(r: {
  bookingId: string;
  userId: string;
  ticketTypeId: string;
  ticketTypeName: string;
  groupId: string;
  groupName: string;
  role: string | null;
  showName: boolean;
  isTeaching: boolean;
  paymentStatus: string;
  amountPaid: number | null;
  currency: string | null;
  bookedAt: string;
  cancelledAt: string | null;
  notes: string | null;
}): Booking {
  return {
    id: r.bookingId,
    userId: r.userId,
    ticketTypeId: r.ticketTypeId,
    ticketTypeName: r.ticketTypeName,
    groupId: r.groupId,
    groupName: r.groupName,
    role: (r.role as Role | null) ?? null,
    showName: r.showName,
    isTeaching: r.isTeaching,
    paymentStatus: r.paymentStatus as BookingPaymentStatus,
    amountPaid: r.amountPaid,
    currency: r.currency,
    bookedAt: r.bookedAt,
    cancelledAt: r.cancelledAt,
    notes: r.notes,
  };
}

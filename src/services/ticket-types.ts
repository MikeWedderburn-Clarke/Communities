import { eq, and, ne, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import type { CreateTicketTypeInput, TicketType } from "@/types";

function nowIso(): string {
  return new Date().toISOString();
}

function ticketTypeId(): string {
  return `tt-${crypto.randomUUID()}`;
}

// ── Writes ─────────────────────────────────────────────────────────

/**
 * Creates a ticket type and its event coverage links atomically.
 * coveredEventIds must contain at least one event ID.
 */
export async function createTicketType(
  db: Db,
  input: CreateTicketTypeInput
): Promise<string> {
  if (input.coveredEventIds.length === 0) {
    throw new Error("A ticket type must cover at least one event.");
  }

  const id = ticketTypeId();

  await db.transaction(async (tx) => {
    await tx.insert(schema.ticketTypes).values({
      id,
      groupId: input.groupId,
      name: input.name,
      description: input.description,
      costAmount: input.costAmount,
      costCurrency: input.costCurrency,
      concessionAmount: input.concessionAmount,
      capacity: input.capacity,
      isAvailable: true,
      sortOrder: input.sortOrder,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await tx.insert(schema.ticketTypeEvents).values(
      input.coveredEventIds.map((eventId) => ({ ticketTypeId: id, eventId }))
    );
  });

  return id;
}

export async function updateTicketType(
  db: Db,
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    costAmount: number;
    costCurrency: string;
    concessionAmount: number | null;
    capacity: number | null;
    isAvailable: boolean;
  }>
): Promise<void> {
  await db
    .update(schema.ticketTypes)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(schema.ticketTypes.id, id));
}

export async function deactivateTicketType(db: Db, id: string): Promise<void> {
  await db
    .update(schema.ticketTypes)
    .set({ isAvailable: false, updatedAt: nowIso() })
    .where(eq(schema.ticketTypes.id, id));
}

// ── Reads ──────────────────────────────────────────────────────────

/**
 * Returns all ticket types for a group, with live bookedCount and coveredEventIds.
 * Includes unavailable types (admin view). Use getTicketTypesForEvent for user-facing queries.
 */
export async function getTicketTypesForGroup(
  db: Db,
  groupId: string
): Promise<TicketType[]> {
  return fetchTicketTypes(db, eq(schema.ticketTypes.groupId, groupId));
}

/**
 * Returns available ticket types for a specific event.
 * Used on the event detail page to determine whether to show the booking flow.
 */
export async function getTicketTypesForEvent(
  db: Db,
  eventId: string
): Promise<TicketType[]> {
  // Find ticket type IDs that cover this event
  const coverageRows = await db
    .select({ ticketTypeId: schema.ticketTypeEvents.ticketTypeId })
    .from(schema.ticketTypeEvents)
    .where(eq(schema.ticketTypeEvents.eventId, eventId));

  if (coverageRows.length === 0) return [];

  const ids = coverageRows.map((r) => r.ticketTypeId);

  return fetchTicketTypes(
    db,
    and(inArray(schema.ticketTypes.id, ids), eq(schema.ticketTypes.isAvailable, true))
  );
}

/**
 * Internal helper: fetches ticket types + their bookedCount + coveredEventIds
 * for a given WHERE condition.
 */
async function fetchTicketTypes(
  db: Db,
  where: Parameters<typeof db.select>[0] extends never ? never : any
): Promise<TicketType[]> {
  // Fetch core ticket type rows
  const typeRows = await db
    .select()
    .from(schema.ticketTypes)
    .where(where)
    .orderBy(schema.ticketTypes.sortOrder, schema.ticketTypes.createdAt);

  if (typeRows.length === 0) return [];

  const ids = typeRows.map((r) => r.id);

  // Fetch booked (non-refunded) counts per ticket type
  const bookedRows = await db
    .select({
      ticketTypeId: schema.bookings.ticketTypeId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.bookings)
    .where(
      and(
        inArray(schema.bookings.ticketTypeId, ids),
        ne(schema.bookings.paymentStatus, "refunded")
      )
    )
    .groupBy(schema.bookings.ticketTypeId);

  const bookedMap = new Map<string, number>(
    bookedRows.map((r) => [r.ticketTypeId, r.count])
  );

  // Fetch covered event IDs per ticket type
  const coverageRows = await db
    .select({
      ticketTypeId: schema.ticketTypeEvents.ticketTypeId,
      eventId: schema.ticketTypeEvents.eventId,
    })
    .from(schema.ticketTypeEvents)
    .where(inArray(schema.ticketTypeEvents.ticketTypeId, ids));

  const coverageMap = new Map<string, string[]>();
  for (const row of coverageRows) {
    const existing = coverageMap.get(row.ticketTypeId) ?? [];
    existing.push(row.eventId);
    coverageMap.set(row.ticketTypeId, existing);
  }

  return typeRows.map((r) => {
    const bookedCount = bookedMap.get(r.id) ?? 0;
    return {
      id: r.id,
      groupId: r.groupId,
      name: r.name,
      description: r.description,
      costAmount: r.costAmount,
      costCurrency: r.costCurrency,
      concessionAmount: r.concessionAmount,
      capacity: r.capacity,
      bookedCount,
      isAvailable: r.isAvailable,
      isSoldOut: r.capacity !== null && bookedCount >= r.capacity,
      sortOrder: r.sortOrder,
      coveredEventIds: coverageMap.get(r.id) ?? [],
    };
  });
}

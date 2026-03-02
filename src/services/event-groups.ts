import { eq, and, ne } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import type {
  CreateEventGroupInput,
  EventGroupDetail,
  EventGroupSummary,
  TicketType,
} from "@/types";
import { getTicketTypesForGroup } from "./ticket-types";

function nowIso(): string {
  return new Date().toISOString();
}

function groupId(): string {
  return `grp-${crypto.randomUUID()}`;
}

// ── Writes ─────────────────────────────────────────────────────────

export async function createEventGroup(
  db: Db,
  input: CreateEventGroupInput,
  createdBy: string
): Promise<string> {
  const id = groupId();
  await db.insert(schema.eventGroups).values({
    id,
    name: input.name,
    description: input.description,
    type: input.type,
    status: "draft",
    createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return id;
}

export async function updateEventGroup(
  db: Db,
  groupId: string,
  patch: Partial<{ name: string; description: string | null; status: "draft" | "published" }>
): Promise<void> {
  await db
    .update(schema.eventGroups)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(schema.eventGroups.id, groupId));
}

/**
 * Publish a group. Validates that at least one available ticket type exists.
 */
export async function publishEventGroup(db: Db, groupId: string): Promise<void> {
  const ticketTypes = await getTicketTypesForGroup(db, groupId);
  const hasAvailable = ticketTypes.some((t) => t.isAvailable);
  if (!hasAvailable) {
    throw new Error("Cannot publish a group with no available ticket types.");
  }
  await db
    .update(schema.eventGroups)
    .set({ status: "published", updatedAt: nowIso() })
    .where(eq(schema.eventGroups.id, groupId));
}

export async function addEventToGroup(
  db: Db,
  groupId: string,
  eventId: string,
  sortOrder: number
): Promise<void> {
  await db
    .insert(schema.eventGroupMembers)
    .values({ groupId, eventId, sortOrder })
    .onConflictDoNothing();
}

export async function removeEventFromGroup(
  db: Db,
  groupId: string,
  eventId: string
): Promise<void> {
  await db
    .delete(schema.eventGroupMembers)
    .where(
      and(
        eq(schema.eventGroupMembers.groupId, groupId),
        eq(schema.eventGroupMembers.eventId, eventId)
      )
    );
}

// ── Reads ──────────────────────────────────────────────────────────

export async function getEventGroupById(
  db: Db,
  id: string,
  includeUnpublished = false
): Promise<EventGroupDetail | null> {
  const rows = await db
    .select({
      id: schema.eventGroups.id,
      name: schema.eventGroups.name,
      description: schema.eventGroups.description,
      type: schema.eventGroups.type,
      status: schema.eventGroups.status,
      createdAt: schema.eventGroups.createdAt,
      updatedAt: schema.eventGroups.updatedAt,
      memberEventId: schema.eventGroupMembers.eventId,
      memberSortOrder: schema.eventGroupMembers.sortOrder,
      memberTitle: schema.events.title,
      memberDateTime: schema.events.dateTime,
      memberEndDateTime: schema.events.endDateTime,
    })
    .from(schema.eventGroups)
    .leftJoin(
      schema.eventGroupMembers,
      eq(schema.eventGroupMembers.groupId, schema.eventGroups.id)
    )
    .leftJoin(schema.events, eq(schema.events.id, schema.eventGroupMembers.eventId))
    .where(
      includeUnpublished
        ? eq(schema.eventGroups.id, id)
        : and(eq(schema.eventGroups.id, id), eq(schema.eventGroups.status, "published"))
    );

  if (rows.length === 0) return null;

  const first = rows[0];
  const ticketTypes = await getTicketTypesForGroup(db, id);

  const memberEvents = rows
    .filter((r) => r.memberEventId !== null)
    .map((r) => ({
      eventId: r.memberEventId!,
      sortOrder: r.memberSortOrder!,
      title: r.memberTitle!,
      dateTime: r.memberDateTime!,
      endDateTime: r.memberEndDateTime!,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.dateTime.localeCompare(b.dateTime));

  return {
    id: first.id,
    name: first.name,
    description: first.description,
    type: first.type as EventGroupDetail["type"],
    status: first.status as EventGroupDetail["status"],
    createdAt: first.createdAt,
    updatedAt: first.updatedAt,
    memberEvents,
    ticketTypes,
  };
}

/**
 * Returns the published group that contains this event, or null.
 * Admins can pass includeUnpublished=true to see draft groups too.
 */
export async function getEventGroupForEvent(
  db: Db,
  eventId: string,
  includeUnpublished = false
): Promise<EventGroupSummary | null> {
  const rows = await db
    .select({
      id: schema.eventGroups.id,
      name: schema.eventGroups.name,
      description: schema.eventGroups.description,
      type: schema.eventGroups.type,
      status: schema.eventGroups.status,
      createdAt: schema.eventGroups.createdAt,
      updatedAt: schema.eventGroups.updatedAt,
    })
    .from(schema.eventGroups)
    .innerJoin(
      schema.eventGroupMembers,
      eq(schema.eventGroupMembers.groupId, schema.eventGroups.id)
    )
    .where(
      includeUnpublished
        ? eq(schema.eventGroupMembers.eventId, eventId)
        : and(
            eq(schema.eventGroupMembers.eventId, eventId),
            eq(schema.eventGroups.status, "published")
          )
    )
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type as EventGroupSummary["type"],
    status: r.status as EventGroupSummary["status"],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listEventGroups(
  db: Db,
  includeUnpublished = false
): Promise<EventGroupSummary[]> {
  const rows = await db
    .select({
      id: schema.eventGroups.id,
      name: schema.eventGroups.name,
      description: schema.eventGroups.description,
      type: schema.eventGroups.type,
      status: schema.eventGroups.status,
      createdAt: schema.eventGroups.createdAt,
      updatedAt: schema.eventGroups.updatedAt,
    })
    .from(schema.eventGroups)
    .where(
      includeUnpublished
        ? undefined
        : eq(schema.eventGroups.status, "published")
    )
    .orderBy(schema.eventGroups.createdAt);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type as EventGroupSummary["type"],
    status: r.status as EventGroupSummary["status"],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

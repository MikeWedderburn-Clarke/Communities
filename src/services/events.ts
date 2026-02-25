import { eq, and, gte } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import type { EventSummary, EventDetail, RoleCounts, Role, ROLES } from "@/types";

type Db = BetterSQLite3Database<typeof schema>;

// ── Helpers ────────────────────────────────────────────────────────

/** Build a zero-initialised RoleCounts then tally from RSVPs. */
export function aggregateRoles(rsvps: { role: string }[]): RoleCounts {
  const counts: RoleCounts = { Base: 0, Flyer: 0, Hybrid: 0, Spotter: 0 };
  for (const r of rsvps) {
    if (r.role in counts) {
      counts[r.role as Role]++;
    }
  }
  return counts;
}

/**
 * Filter attendees to those with showName=true, returning only name + role.
 * This is the ONLY path through which attendee names are exposed.
 */
export function visibleAttendees(
  rsvps: { showName: boolean; role: string; userName: string }[]
): { name: string; role: Role }[] {
  return rsvps
    .filter((r) => r.showName)
    .map((r) => ({ name: r.userName, role: r.role as Role }));
}

// ── Queries ────────────────────────────────────────────────────────

export async function getUpcomingEvents(db: Db): Promise<EventSummary[]> {
  const now = new Date().toISOString();
  const rows = await db
    .select()
    .from(schema.events)
    .where(gte(schema.events.dateTime, now))
    .orderBy(schema.events.dateTime);

  const summaries: EventSummary[] = [];
  for (const event of rows) {
    const eventRsvps = await db
      .select({ role: schema.rsvps.role })
      .from(schema.rsvps)
      .where(eq(schema.rsvps.eventId, event.id));

    summaries.push({
      id: event.id,
      title: event.title,
      description: event.description,
      dateTime: event.dateTime,
      endDateTime: event.endDateTime,
      location: event.location,
      attendeeCount: eventRsvps.length,
      roleCounts: aggregateRoles(eventRsvps),
    });
  }
  return summaries;
}

export async function getAllEvents(db: Db): Promise<EventSummary[]> {
  const rows = await db
    .select()
    .from(schema.events)
    .orderBy(schema.events.dateTime);

  const summaries: EventSummary[] = [];
  for (const event of rows) {
    const eventRsvps = await db
      .select({ role: schema.rsvps.role })
      .from(schema.rsvps)
      .where(eq(schema.rsvps.eventId, event.id));

    summaries.push({
      id: event.id,
      title: event.title,
      description: event.description,
      dateTime: event.dateTime,
      endDateTime: event.endDateTime,
      location: event.location,
      attendeeCount: eventRsvps.length,
      roleCounts: aggregateRoles(eventRsvps),
    });
  }
  return summaries;
}

export async function getEventDetail(
  db: Db,
  eventId: string,
  currentUserId: string | null
): Promise<EventDetail | null> {
  const [event] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1);

  if (!event) return null;

  const rsvpRows = await db
    .select({
      role: schema.rsvps.role,
      showName: schema.rsvps.showName,
      userId: schema.rsvps.userId,
      userName: schema.users.name,
    })
    .from(schema.rsvps)
    .innerJoin(schema.users, eq(schema.rsvps.userId, schema.users.id))
    .where(eq(schema.rsvps.eventId, eventId));

  const roleCounts = aggregateRoles(rsvpRows);

  // Only expose names to logged-in users
  const visible = currentUserId ? visibleAttendees(rsvpRows) : [];

  // Check if current user has RSVP'd
  let currentUserRsvp: EventDetail["currentUserRsvp"] = null;
  if (currentUserId) {
    const match = rsvpRows.find((r) => r.userId === currentUserId);
    if (match) {
      currentUserRsvp = { role: match.role as Role, showName: match.showName };
    }
  }

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    dateTime: event.dateTime,
    endDateTime: event.endDateTime,
    location: event.location,
    attendeeCount: rsvpRows.length,
    roleCounts,
    visibleAttendees: visible,
    currentUserRsvp,
  };
}

export async function createOrUpdateRsvp(
  db: Db,
  userId: string,
  eventId: string,
  role: Role,
  showName: boolean
): Promise<void> {
  // Check if user already has an RSVP for this event
  const [existing] = await db
    .select()
    .from(schema.rsvps)
    .where(
      and(eq(schema.rsvps.eventId, eventId), eq(schema.rsvps.userId, userId))
    )
    .limit(1);

  if (existing) {
    await db
      .update(schema.rsvps)
      .set({ role, showName })
      .where(eq(schema.rsvps.id, existing.id));
  } else {
    await db.insert(schema.rsvps).values({ eventId, userId, role, showName });
  }
}

export async function deleteRsvp(
  db: Db,
  userId: string,
  eventId: string
): Promise<boolean> {
  const result = await db
    .delete(schema.rsvps)
    .where(
      and(eq(schema.rsvps.eventId, eventId), eq(schema.rsvps.userId, userId))
    );
  return result.changes > 0;
}

export async function getEventById(
  db: Db,
  eventId: string
): Promise<typeof schema.events.$inferSelect | null> {
  const [event] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1);
  return event ?? null;
}

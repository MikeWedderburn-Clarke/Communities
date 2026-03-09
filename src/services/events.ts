import { eq, and, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { computeNextOccurrence } from "@/lib/recurrence";
import { batchCanViewSocialLinks } from "@/services/users";
import type { EventSummary, EventDetail, EventRow, RoleCounts, Role, SkillLevel, EventCategory, RecurrenceFrequency, TeacherRequest, PendingEvent, EventStatus, CreateEventInput, Location, RecurrenceRule } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────

/** Build a zero-initialised RoleCounts then tally from RSVPs. */
export function aggregateRoles(rsvps: { role: string }[]): RoleCounts {
  const counts: RoleCounts = { Base: 0, Flyer: 0, Hybrid: 0 };
  for (const r of rsvps) {
    if (r.role === "Base" || r.role === "Flyer" || r.role === "Hybrid") {
      counts[r.role]++;
    }
  }
  return counts;
}

/**
 * Build the list of attendees visible to the current viewer.
 *
 * Rules:
 * - Admin: sees ALL attendees. Those with showName=false get hidden=true.
 * - Regular user: sees attendees with showName=true (hidden=false),
 *   plus their own entry if they RSVP'd with showName=false (hidden=true).
 * - Anonymous: empty array (handled by caller).
 */
export function visibleAttendees(
  rsvps: { showName: boolean; role: string; userName: string; userId: string; isTeaching: boolean; facebookUrl: string | null; instagramUrl: string | null; websiteUrl: string | null; youtubeUrl: string | null; profileVisibility: string }[],
  viewerUserId: string | null,
  isAdmin: boolean,
  canViewSet: Set<string>
): { userId: string; name: string; role: Role; hidden: boolean; isTeaching: boolean; socialLinks: { facebook?: string; instagram?: string; website?: string; youtube?: string } }[] {
  function buildSocialLinks(r: typeof rsvps[number]) {
    const links: { facebook?: string; instagram?: string; website?: string; youtube?: string } = {};
    const canView = canViewSet.has(r.userId);
    if (canView && r.facebookUrl) links.facebook = r.facebookUrl;
    if (canView && r.instagramUrl) links.instagram = r.instagramUrl;
    if (canView && r.websiteUrl) links.website = r.websiteUrl;
    if (canView && r.youtubeUrl) links.youtube = r.youtubeUrl;
    return links;
  }

  if (isAdmin) {
    return rsvps.map((r) => ({
      userId: r.userId,
      name: r.userName,
      role: r.role as Role,
      hidden: !r.showName,
      isTeaching: r.isTeaching,
      socialLinks: buildSocialLinks(r),
    }));
  }

  return rsvps
    .filter((r) => r.showName || r.userId === viewerUserId)
    .map((r) => ({
      userId: r.userId,
      name: r.userName,
      role: r.role as Role,
      hidden: !r.showName,
      isTeaching: r.isTeaching,
      socialLinks: buildSocialLinks(r),
    }));
}

// ── Event queries ──────────────────────────────────────────────────

type EventListRow = {
  eventId: string;
  title: string;
  description: string;
  dateTime: string;
  endDateTime: string;
  recurrenceType: string;
  recurrenceEndDate: string | null;
  locationId: string;
  locationName: string;
  locationCity: string;
  locationCountry: string;
  locationLat: number;
  locationLon: number;
  locationWhat3names: string | null;
  locationHowToFind: string | null;
  dateAdded: string;
  lastUpdated: string;
  skillLevel: string;
  prerequisites: string | null;
  costAmount: number | null;
  costCurrency: string | null;
  concessionAmount: number | null;
  maxAttendees: number | null;
  eventCategory: string;
  isExternal: boolean;
  externalUrl: string | null;
  posterUrl: string | null;
  rsvpRole: string | null;
  rsvpIsTeaching: boolean | null;
  rsvpOccurrenceDate: string | null;
};

/**
 * Groups flat rows from a single events+locations LEFT JOIN rsvps query
 * into EventSummary objects.  Events with no RSVPs produce one row with
 * null rsvp columns; those are counted correctly (zero attendees).
 * Row order from the DB (by dateTime) is preserved via Map insertion order.
 */
function groupEventRows(rows: EventListRow[]): EventSummary[] {
  const map = new Map<string, EventSummary>();
  for (const row of rows) {
    if (!map.has(row.eventId)) {
      map.set(row.eventId, {
        id: row.eventId,
        title: row.title,
        description: row.description,
        dateTime: row.dateTime,
        endDateTime: row.endDateTime,
        recurrence: recurrenceFromValues(row.recurrenceType, row.recurrenceEndDate),
        nextOccurrence: null,
        location: {
          id: row.locationId,
          name: row.locationName,
          city: row.locationCity,
          country: row.locationCountry,
          latitude: row.locationLat,
          longitude: row.locationLon,
          what3names: row.locationWhat3names,
          howToFind: row.locationHowToFind,
        },
        attendeeCount: 0,
        roleCounts: { Base: 0, Flyer: 0, Hybrid: 0 },
        teacherCount: 0,
        occurrenceAttendance: null,
        dateAdded: row.dateAdded,
        lastUpdated: row.lastUpdated,
        skillLevel: row.skillLevel as SkillLevel,
        prerequisites: row.prerequisites,
        costAmount: row.costAmount,
        costCurrency: row.costCurrency,
        concessionAmount: row.concessionAmount,
        maxAttendees: row.maxAttendees,
        isFull: false, // recomputed after attendeeCount is tallied
        isPast: false, // set by finalizeEventSummaries
        userRsvp: null, // populated by page.tsx after getUserRsvpMap
        // Group/ticket fields — not populated in list queries for performance.
        // Correctly populated in getEventDetail.
        groupId: null,
        groupName: null,
        hasTicketTypes: false,
        eventCategory: row.eventCategory as EventCategory,
        isExternal: row.isExternal,
        externalUrl: row.externalUrl,
        posterUrl: row.posterUrl,
        interestedCount: 0, // populated by page.tsx after getInterestCounts
        isInterested: false, // populated by page.tsx after getUserInterestSet
      });
    }
    if (row.rsvpRole !== null) {
      const summary = map.get(row.eventId)!;
      summary.attendeeCount++;
      if (row.rsvpRole in summary.roleCounts) {
        summary.roleCounts[row.rsvpRole as Role]++;
      }
      if (row.rsvpIsTeaching) summary.teacherCount++;
      summary.isFull = summary.maxAttendees !== null && summary.attendeeCount >= summary.maxAttendees;
      // Per-occurrence bucketing
      if (row.rsvpOccurrenceDate) {
        if (!summary.occurrenceAttendance) summary.occurrenceAttendance = {};
        const key = row.rsvpOccurrenceDate;
        const occ = summary.occurrenceAttendance[key] ?? { attendeeCount: 0, roleCounts: { Base: 0, Flyer: 0, Hybrid: 0 }, teacherCount: 0 };
        occ.attendeeCount++;
        if (row.rsvpRole in occ.roleCounts) occ.roleCounts[row.rsvpRole as Role]++;
        if (row.rsvpIsTeaching) occ.teacherCount++;
        summary.occurrenceAttendance[key] = occ;
      }
    }
  }
  return Array.from(map.values());
}
function recurrenceFromValues(type: string, endDate: string | null): RecurrenceRule | null {
  if (!type || type === "none") return null;
  return { frequency: type as RecurrenceRule["frequency"], endDate };
}

function attachNextOccurrence(summary: EventSummary, referenceIso: string): EventSummary {
  summary.nextOccurrence = computeNextOccurrence(summary.dateTime, summary.endDateTime, summary.recurrence, referenceIso);
  return summary;
}

function finalizeEventSummaries(rows: EventListRow[], referenceIso: string): EventSummary[] {
  const summaries = groupEventRows(rows).map((event) => {
    attachNextOccurrence(event, referenceIso);
    event.isPast = event.nextOccurrence === null;
    return event;
  });
  const getSortValue = (event: EventSummary) => event.nextOccurrence?.dateTime ?? event.dateTime;
  return summaries.sort((a, b) => getSortValue(a).localeCompare(getSortValue(b)));
}

const EVENT_LIST_SELECT = (s: typeof schema) => ({
  eventId: s.events.id,
  title: s.events.title,
  description: s.events.description,
  dateTime: s.events.dateTime,
  endDateTime: s.events.endDateTime,
  recurrenceType: s.events.recurrenceType,
  recurrenceEndDate: s.events.recurrenceEndDate,
  locationId: s.locations.id,
  locationName: s.locations.name,
  locationCity: s.locations.city,
  locationCountry: s.locations.country,
  locationLat: s.locations.latitude,
  locationLon: s.locations.longitude,
  locationWhat3names: s.locations.what3names,
  locationHowToFind: s.locations.howToFind,
  dateAdded: s.events.dateAdded,
  lastUpdated: s.events.lastUpdated,
  skillLevel: s.events.skillLevel,
  prerequisites: s.events.prerequisites,
  costAmount: s.events.costAmount,
  costCurrency: s.events.costCurrency,
  concessionAmount: s.events.concessionAmount,
  maxAttendees: s.events.maxAttendees,
  eventCategory: s.events.eventCategory,
  isExternal: s.events.isExternal,
  externalUrl: s.events.externalUrl,
  posterUrl: s.events.posterUrl,
  rsvpRole: s.rsvps.role,
  rsvpIsTeaching: s.rsvps.isTeaching,
  rsvpOccurrenceDate: s.rsvps.occurrenceDate,
});

export async function getUpcomingEvents(db: Db): Promise<EventSummary[]> {
  const now = new Date().toISOString();
  const rows = await db
    .select(EVENT_LIST_SELECT(schema))
    .from(schema.events)
    .innerJoin(schema.locations, eq(schema.events.locationId, schema.locations.id))
    .leftJoin(schema.rsvps, eq(schema.rsvps.eventId, schema.events.id))
    .where(eq(schema.events.status, "approved"))
    .orderBy(schema.events.dateTime);
  return finalizeEventSummaries(rows, now).filter((e) => !e.isPast);
}

export async function getAllEvents(db: Db): Promise<EventSummary[]> {
  const now = new Date().toISOString();
  const rows = await db
    .select(EVENT_LIST_SELECT(schema))
    .from(schema.events)
    .innerJoin(schema.locations, eq(schema.events.locationId, schema.locations.id))
    .leftJoin(schema.rsvps, eq(schema.rsvps.eventId, schema.events.id))
    .where(eq(schema.events.status, "approved"))
    .orderBy(schema.events.dateTime);
  return finalizeEventSummaries(rows, now);
}

export async function getEventDetail(
  db: Db,
  eventId: string,
  currentUserId: string | null,
  isAdmin: boolean = false
): Promise<EventDetail | null> {
  // Fetch event + location in a single JOIN rather than two round-trips.
  const [eventRow] = await db
    .select({
      id: schema.events.id,
      title: schema.events.title,
      description: schema.events.description,
      dateTime: schema.events.dateTime,
      endDateTime: schema.events.endDateTime,
      recurrenceType: schema.events.recurrenceType,
      recurrenceEndDate: schema.events.recurrenceEndDate,
      status: schema.events.status,
      dateAdded: schema.events.dateAdded,
      lastUpdated: schema.events.lastUpdated,
      skillLevel: schema.events.skillLevel,
      prerequisites: schema.events.prerequisites,
      costAmount: schema.events.costAmount,
      costCurrency: schema.events.costCurrency,
      concessionAmount: schema.events.concessionAmount,
      maxAttendees: schema.events.maxAttendees,
      eventCategory: schema.events.eventCategory,
      isExternal: schema.events.isExternal,
      externalUrl: schema.events.externalUrl,
      posterUrl: schema.events.posterUrl,
      locationId: schema.locations.id,
      locationName: schema.locations.name,
      locationCity: schema.locations.city,
      locationCountry: schema.locations.country,
      locationLat: schema.locations.latitude,
      locationLon: schema.locations.longitude,
      locationWhat3names: schema.locations.what3names,
      locationHowToFind: schema.locations.howToFind,
    })
    .from(schema.events)
    .innerJoin(schema.locations, eq(schema.events.locationId, schema.locations.id))
    .where(eq(schema.events.id, eventId))
    .limit(1);

  if (!eventRow) return null;

  const recurrence = recurrenceFromValues(eventRow.recurrenceType, eventRow.recurrenceEndDate);

  const location: Location = {
    id: eventRow.locationId,
    name: eventRow.locationName,
    city: eventRow.locationCity,
    country: eventRow.locationCountry,
    latitude: eventRow.locationLat,
    longitude: eventRow.locationLon,
    what3names: eventRow.locationWhat3names,
    howToFind: eventRow.locationHowToFind,
  };

  const rsvpRows = await db
    .select({
      role: schema.rsvps.role,
      showName: schema.rsvps.showName,
      userId: schema.rsvps.userId,
      userName: schema.users.name,
      isTeaching: schema.rsvps.isTeaching,
      facebookUrl: schema.users.facebookUrl,
      instagramUrl: schema.users.instagramUrl,
      websiteUrl: schema.users.websiteUrl,
      youtubeUrl: schema.users.youtubeUrl,
      profileVisibility: schema.users.profileVisibility,
    })
    .from(schema.rsvps)
    .innerJoin(schema.users, eq(schema.rsvps.userId, schema.users.id))
    .where(eq(schema.rsvps.eventId, eventId));

  const roleCounts = aggregateRoles(rsvpRows);

  // Only expose names to logged-in users; admin sees all
  const canViewSet = await batchCanViewSocialLinks(db, rsvpRows, currentUserId, isAdmin);
  const visible = currentUserId
    ? visibleAttendees(rsvpRows, currentUserId, isAdmin, canViewSet)
    : [];

  // Check if current user has RSVP'd
  let currentUserRsvp: EventDetail["currentUserRsvp"] = null;
  if (currentUserId) {
    const match = rsvpRows.find((r) => r.userId === currentUserId);
    if (match) {
      currentUserRsvp = { role: match.role as Role, showName: match.showName, isTeaching: match.isTeaching };
    }
  }

  return {
    id: eventRow.id,
    title: eventRow.title,
    description: eventRow.description,
    dateTime: eventRow.dateTime,
    endDateTime: eventRow.endDateTime,
    dateAdded: eventRow.dateAdded,
    lastUpdated: eventRow.lastUpdated,
    recurrence,
    nextOccurrence: computeNextOccurrence(eventRow.dateTime, eventRow.endDateTime, recurrence),
    location,
    attendeeCount: rsvpRows.length,
    roleCounts,
    teacherCount: rsvpRows.filter((r) => r.isTeaching).length,
    occurrenceAttendance: null,
    visibleAttendees: visible,
    currentUserRsvp,
    skillLevel: eventRow.skillLevel as SkillLevel,
    prerequisites: eventRow.prerequisites,
    costAmount: eventRow.costAmount,
    costCurrency: eventRow.costCurrency,
    concessionAmount: eventRow.concessionAmount,
    maxAttendees: eventRow.maxAttendees,
    isFull: eventRow.maxAttendees !== null && rsvpRows.length >= eventRow.maxAttendees,
    isPast: computeNextOccurrence(eventRow.dateTime, eventRow.endDateTime, recurrence) === null,
    userRsvp: null,
    // Group/ticket fields — populated by the page after calling event-groups service
    groupId: null,
    groupName: null,
    hasTicketTypes: false,
    eventCategory: eventRow.eventCategory as EventCategory,
    isExternal: eventRow.isExternal,
    externalUrl: eventRow.externalUrl,
    posterUrl: eventRow.posterUrl,
    interestedCount: 0, // populated by caller via getEventInterestInfo
    isInterested: false, // populated by caller via getEventInterestInfo
    ticketTypes: [],
    userBooking: null,
  };
}

export async function createOrUpdateRsvp(
  db: Db,
  userId: string,
  eventId: string,
  role: Role,
  showName: boolean,
  isTeaching: boolean = false,
  occurrenceDate: string | null = null
): Promise<void> {
  if (occurrenceDate === null) {
    await db
      .insert(schema.rsvps)
      .values({ eventId, userId, role, showName, isTeaching, occurrenceDate: null })
      .onConflictDoUpdate({
        target: [schema.rsvps.eventId, schema.rsvps.userId],
        targetWhere: sql`${schema.rsvps.occurrenceDate} IS NULL`,
        set: { role, showName, isTeaching },
      });
  } else {
    await db
      .insert(schema.rsvps)
      .values({ eventId, userId, role, showName, isTeaching, occurrenceDate })
      .onConflictDoUpdate({
        target: [schema.rsvps.eventId, schema.rsvps.userId, schema.rsvps.occurrenceDate],
        targetWhere: sql`${schema.rsvps.occurrenceDate} IS NOT NULL`,
        set: { role, showName, isTeaching },
      });
  }

  // Remove any "interested" record now that the user is "going"
  await db
    .delete(schema.eventInterests)
    .where(
      and(
        eq(schema.eventInterests.eventId, eventId),
        eq(schema.eventInterests.userId, userId)
      )
    );
}

export async function deleteRsvp(
  db: Db,
  userId: string,
  eventId: string,
  occurrenceDate: string | null = null
): Promise<boolean> {
  const condition = occurrenceDate === null
    ? and(eq(schema.rsvps.eventId, eventId), eq(schema.rsvps.userId, userId), isNull(schema.rsvps.occurrenceDate))
    : and(eq(schema.rsvps.eventId, eventId), eq(schema.rsvps.userId, userId), eq(schema.rsvps.occurrenceDate, occurrenceDate));
  const rows = await db
    .delete(schema.rsvps)
    .where(condition)
    .returning({ id: schema.rsvps.id });
  return rows.length > 0;
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

/** Returns a map of eventId → {role, paymentStatus} for a specific user's RSVPs.
 *  Null-occurrence RSVPs (standing/non-recurring) take priority when multiple exist for an event. */
export async function getUserRsvpMap(
  db: Db,
  userId: string
): Promise<Record<string, { role: Role; paymentStatus: string | null }>> {
  const rows = await db
    .select({
      eventId: schema.rsvps.eventId,
      occurrenceDate: schema.rsvps.occurrenceDate,
      role: schema.rsvps.role,
      paymentStatus: schema.rsvps.paymentStatus,
    })
    .from(schema.rsvps)
    .where(eq(schema.rsvps.userId, userId));
  const map: Record<string, { role: Role; paymentStatus: string | null }> = {};
  for (const r of rows) {
    // Null-occurrence (standing) RSVPs take priority; don't overwrite with a per-occurrence one.
    if (!map[r.eventId] || r.occurrenceDate === null) {
      map[r.eventId] = { role: r.role as Role, paymentStatus: r.paymentStatus ?? null };
    }
  }
  return map;
}

// ── Teacher request/approval ───────────────────────────────────────

export async function requestTeacherStatus(db: Db, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ teacherRequestedAt: new Date().toISOString() })
    .where(eq(schema.users.id, userId));
}

export async function getPendingTeacherRequests(db: Db): Promise<TeacherRequest[]> {
  const rows = await db
    .select({
      userId: schema.users.id,
      userName: schema.users.name,
      userEmail: schema.users.email,
      requestedAt: schema.users.teacherRequestedAt,
    })
    .from(schema.users)
    .where(
      and(
        isNotNull(schema.users.teacherRequestedAt),
        eq(schema.users.isTeacherApproved, false)
      )
    );

  return rows
    .filter((r): r is typeof r & { requestedAt: string } => r.requestedAt !== null)
    .map((r) => ({
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      requestedAt: r.requestedAt,
    }));
}

export async function approveTeacher(db: Db, userId: string, approvedBy: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ isTeacherApproved: true, teacherApprovedBy: approvedBy })
    .where(eq(schema.users.id, userId));
}

export async function denyTeacher(db: Db, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ teacherRequestedAt: null, isTeacherApproved: false, teacherApprovedBy: null })
    .where(eq(schema.users.id, userId));
}

// ── Event creation / approval ──────────────────────────────────────

export async function createEvent(
  db: Db,
  input: CreateEventInput,
  createdBy: string,
  isAdmin: boolean
): Promise<string> {
  const id = `evt-${crypto.randomUUID()}`;
  const status: EventStatus = isAdmin ? "approved" : "pending";
  const now = new Date().toISOString();
  await db.insert(schema.events).values({
    id,
    title: input.title,
    description: input.description,
    dateTime: input.dateTime,
    endDateTime: input.endDateTime,
    locationId: input.locationId,
      recurrenceType: input.recurrence?.frequency ?? "none",
      recurrenceEndDate: input.recurrence?.endDate ?? null,
    skillLevel: input.skillLevel,
    prerequisites: input.prerequisites,
    costAmount: input.costAmount,
    costCurrency: input.costCurrency,
    concessionAmount: input.concessionAmount,
    maxAttendees: input.maxAttendees,
    eventCategory: input.eventCategory,
    isExternal: input.isExternal,
    externalUrl: input.externalUrl,
    posterUrl: input.posterUrl,
    status,
    createdBy,
    dateAdded: now,
    lastUpdated: now,
  });
  return id;
}

export async function getPendingEvents(db: Db): Promise<PendingEvent[]> {
  const rows = await db
    .select({
      id: schema.events.id,
      title: schema.events.title,
      dateTime: schema.events.dateTime,
      locationName: schema.locations.name,
      createdByName: schema.users.name,
      createdByEmail: schema.users.email,
    })
    .from(schema.events)
    .innerJoin(schema.users, eq(schema.events.createdBy, schema.users.id))
    .innerJoin(schema.locations, eq(schema.events.locationId, schema.locations.id))
    .where(eq(schema.events.status, "pending"))
    .orderBy(schema.events.dateTime);

  return rows;
}

export async function approveEvent(db: Db, eventId: string): Promise<void> {
  await db
    .update(schema.events)
    .set({ status: "approved" })
    .where(eq(schema.events.id, eventId));
}

export async function rejectEvent(db: Db, eventId: string): Promise<void> {
  await db
    .update(schema.events)
    .set({ status: "rejected" })
    .where(eq(schema.events.id, eventId));
}

// ── Interest (watchlist) ───────────────────────────────────────────

/**
 * Toggle interest: if the user is interested, remove it; otherwise add it.
 * Returns the new state.
 */
export async function toggleInterest(
  db: Db,
  userId: string,
  eventId: string
): Promise<{ interested: boolean }> {
  const [existing] = await db
    .select({ eventId: schema.eventInterests.eventId })
    .from(schema.eventInterests)
    .where(
      and(
        eq(schema.eventInterests.eventId, eventId),
        eq(schema.eventInterests.userId, userId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .delete(schema.eventInterests)
      .where(
        and(
          eq(schema.eventInterests.eventId, eventId),
          eq(schema.eventInterests.userId, userId)
        )
      );
    return { interested: false };
  } else {
    await db
      .insert(schema.eventInterests)
      .values({ eventId, userId, createdAt: new Date().toISOString() });
    return { interested: true };
  }
}

/** Returns a Set of event IDs the user is interested in. */
export async function getUserInterestSet(
  db: Db,
  userId: string
): Promise<Set<string>> {
  const rows = await db
    .select({ eventId: schema.eventInterests.eventId })
    .from(schema.eventInterests)
    .where(eq(schema.eventInterests.userId, userId));
  return new Set(rows.map((r) => r.eventId));
}

/** Returns interested count per event for a list of event IDs. */
export async function getInterestCounts(
  db: Db,
  eventIds: string[]
): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  const rows = await db
    .select({
      eventId: schema.eventInterests.eventId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(schema.eventInterests)
    .where(sql`${schema.eventInterests.eventId} IN (${sql.join(eventIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(schema.eventInterests.eventId);
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.eventId] = Number(row.count);
  }
  return map;
}

/** Returns interested count and whether a specific user is interested for a single event. */
export async function getEventInterestInfo(
  db: Db,
  eventId: string,
  userId: string | null
): Promise<{ interestedCount: number; isInterested: boolean }> {
  const countRows = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(schema.eventInterests)
    .where(eq(schema.eventInterests.eventId, eventId));
  const interestedCount = Number(countRows[0]?.count ?? 0);

  let isInterested = false;
  if (userId) {
    const [existing] = await db
      .select({ eventId: schema.eventInterests.eventId })
      .from(schema.eventInterests)
      .where(
        and(
          eq(schema.eventInterests.eventId, eventId),
          eq(schema.eventInterests.userId, userId)
        )
      )
      .limit(1);
    isInterested = !!existing;
  }

  return { interestedCount, isInterested };
}

/**
 * Return all events as raw rows for the events table view.
 * Includes location name and creator name for display.
 * Admin-only: includes all statuses; regular callers see all statuses too
 * since status is a visible column in this view.
 */
export async function getAllEventsRaw(db: Db): Promise<EventRow[]> {
  const createdByAlias = schema.users;
  const rows = await db
    .select({
      id: schema.events.id,
      title: schema.events.title,
      description: schema.events.description,
      dateTime: schema.events.dateTime,
      endDateTime: schema.events.endDateTime,
      locationId: schema.events.locationId,
      locationName: schema.locations.name,
      status: schema.events.status,
      createdBy: schema.events.createdBy,
      createdByName: createdByAlias.name,
      dateAdded: schema.events.dateAdded,
      lastUpdated: schema.events.lastUpdated,
      recurrenceType: schema.events.recurrenceType,
      recurrenceEndDate: schema.events.recurrenceEndDate,
      skillLevel: schema.events.skillLevel,
      prerequisites: schema.events.prerequisites,
      costAmount: schema.events.costAmount,
      costCurrency: schema.events.costCurrency,
      concessionAmount: schema.events.concessionAmount,
      maxAttendees: schema.events.maxAttendees,
      eventCategory: schema.events.eventCategory,
      isExternal: schema.events.isExternal,
      externalUrl: schema.events.externalUrl,
      posterUrl: schema.events.posterUrl,
    })
    .from(schema.events)
    .innerJoin(schema.locations, eq(schema.events.locationId, schema.locations.id))
    .leftJoin(createdByAlias, eq(schema.events.createdBy, createdByAlias.id))
    .orderBy(schema.events.dateTime);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    dateTime: row.dateTime,
    endDateTime: row.endDateTime,
    locationId: row.locationId,
    locationName: row.locationName,
    status: row.status as EventStatus,
    createdBy: row.createdBy ?? null,
    createdByName: row.createdByName ?? null,
    dateAdded: row.dateAdded,
    lastUpdated: row.lastUpdated,
    recurrenceType: row.recurrenceType as RecurrenceFrequency,
    recurrenceEndDate: row.recurrenceEndDate ?? null,
    skillLevel: row.skillLevel as SkillLevel,
    prerequisites: row.prerequisites ?? null,
    costAmount: row.costAmount ?? null,
    costCurrency: row.costCurrency ?? null,
    concessionAmount: row.concessionAmount ?? null,
    maxAttendees: row.maxAttendees ?? null,
    eventCategory: row.eventCategory as EventCategory,
    isExternal: row.isExternal,
    externalUrl: row.externalUrl ?? null,
    posterUrl: row.posterUrl ?? null,
  }));
}

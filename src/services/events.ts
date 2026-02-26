import { eq, and, gte, isNotNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import type { EventSummary, EventDetail, RoleCounts, Role, TeacherRequest, PendingEvent, EventStatus, CreateEventInput, Location } from "@/types";

type Db = BetterSQLite3Database<typeof schema>;

// ── Helpers ────────────────────────────────────────────────────────

/** Build a zero-initialised RoleCounts then tally from RSVPs. */
export function aggregateRoles(rsvps: { role: string }[]): RoleCounts {
  const counts: RoleCounts = { Base: 0, Flyer: 0, Hybrid: 0 };
  for (const r of rsvps) {
    if (r.role in counts) {
      counts[r.role as Role]++;
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
  rsvps: { showName: boolean; role: string; userName: string; userId: string; isTeaching: boolean; facebookUrl: string | null; instagramUrl: string | null; websiteUrl: string | null; youtubeUrl: string | null; showFacebook: boolean; showInstagram: boolean; showWebsite: boolean; showYoutube: boolean }[],
  viewerUserId: string | null,
  isAdmin: boolean
): { userId: string; name: string; role: Role; hidden: boolean; isTeaching: boolean; socialLinks: { facebook?: string; instagram?: string; website?: string; youtube?: string } }[] {
  function buildSocialLinks(r: typeof rsvps[number]) {
    const links: { facebook?: string; instagram?: string; website?: string; youtube?: string } = {};
    if (r.showFacebook && r.facebookUrl) links.facebook = r.facebookUrl;
    if (r.showInstagram && r.instagramUrl) links.instagram = r.instagramUrl;
    if (r.showWebsite && r.websiteUrl) links.website = r.websiteUrl;
    if (r.showYoutube && r.youtubeUrl) links.youtube = r.youtubeUrl;
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
  locationId: string;
  locationName: string;
  locationCity: string;
  locationCountry: string;
  locationLat: number;
  locationLon: number;
  rsvpRole: string | null;
  rsvpIsTeaching: boolean | null;
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
        location: {
          id: row.locationId,
          name: row.locationName,
          city: row.locationCity,
          country: row.locationCountry,
          latitude: row.locationLat,
          longitude: row.locationLon,
        },
        attendeeCount: 0,
        roleCounts: { Base: 0, Flyer: 0, Hybrid: 0 },
        teacherCount: 0,
      });
    }
    if (row.rsvpRole !== null) {
      const summary = map.get(row.eventId)!;
      summary.attendeeCount++;
      if (row.rsvpRole in summary.roleCounts) {
        summary.roleCounts[row.rsvpRole as Role]++;
      }
      if (row.rsvpIsTeaching) summary.teacherCount++;
    }
  }
  return Array.from(map.values());
}

const EVENT_LIST_SELECT = (s: typeof schema) => ({
  eventId: s.events.id,
  title: s.events.title,
  description: s.events.description,
  dateTime: s.events.dateTime,
  endDateTime: s.events.endDateTime,
  locationId: s.locations.id,
  locationName: s.locations.name,
  locationCity: s.locations.city,
  locationCountry: s.locations.country,
  locationLat: s.locations.latitude,
  locationLon: s.locations.longitude,
  rsvpRole: s.rsvps.role,
  rsvpIsTeaching: s.rsvps.isTeaching,
});

export async function getUpcomingEvents(db: Db): Promise<EventSummary[]> {
  const now = new Date().toISOString();
  const rows = await db
    .select(EVENT_LIST_SELECT(schema))
    .from(schema.events)
    .innerJoin(schema.locations, eq(schema.events.locationId, schema.locations.id))
    .leftJoin(schema.rsvps, eq(schema.rsvps.eventId, schema.events.id))
    .where(and(gte(schema.events.dateTime, now), eq(schema.events.status, "approved")))
    .orderBy(schema.events.dateTime);
  return groupEventRows(rows);
}

export async function getAllEvents(db: Db): Promise<EventSummary[]> {
  const rows = await db
    .select(EVENT_LIST_SELECT(schema))
    .from(schema.events)
    .innerJoin(schema.locations, eq(schema.events.locationId, schema.locations.id))
    .leftJoin(schema.rsvps, eq(schema.rsvps.eventId, schema.events.id))
    .where(eq(schema.events.status, "approved"))
    .orderBy(schema.events.dateTime);
  return groupEventRows(rows);
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
      status: schema.events.status,
      locationId: schema.locations.id,
      locationName: schema.locations.name,
      locationCity: schema.locations.city,
      locationCountry: schema.locations.country,
      locationLat: schema.locations.latitude,
      locationLon: schema.locations.longitude,
    })
    .from(schema.events)
    .innerJoin(schema.locations, eq(schema.events.locationId, schema.locations.id))
    .where(eq(schema.events.id, eventId))
    .limit(1);

  if (!eventRow) return null;

  const location: Location = {
    id: eventRow.locationId,
    name: eventRow.locationName,
    city: eventRow.locationCity,
    country: eventRow.locationCountry,
    latitude: eventRow.locationLat,
    longitude: eventRow.locationLon,
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
      showFacebook: schema.users.showFacebook,
      showInstagram: schema.users.showInstagram,
      showWebsite: schema.users.showWebsite,
      showYoutube: schema.users.showYoutube,
    })
    .from(schema.rsvps)
    .innerJoin(schema.users, eq(schema.rsvps.userId, schema.users.id))
    .where(eq(schema.rsvps.eventId, eventId));

  const roleCounts = aggregateRoles(rsvpRows);

  // Only expose names to logged-in users; admin sees all
  const visible = currentUserId
    ? visibleAttendees(rsvpRows, currentUserId, isAdmin)
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
    location,
    attendeeCount: rsvpRows.length,
    roleCounts,
    teacherCount: rsvpRows.filter((r) => r.isTeaching).length,
    visibleAttendees: visible,
    currentUserRsvp,
  };
}

export async function createOrUpdateRsvp(
  db: Db,
  userId: string,
  eventId: string,
  role: Role,
  showName: boolean,
  isTeaching: boolean = false
): Promise<void> {
  // Single upsert instead of SELECT + INSERT/UPDATE
  await db
    .insert(schema.rsvps)
    .values({ eventId, userId, role, showName, isTeaching })
    .onConflictDoUpdate({
      target: [schema.rsvps.eventId, schema.rsvps.userId],
      set: { role, showName, isTeaching },
    });
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
  await db.insert(schema.events).values({
    id,
    title: input.title,
    description: input.description,
    dateTime: input.dateTime,
    endDateTime: input.endDateTime,
    locationId: input.locationId,
    status,
    createdBy,
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

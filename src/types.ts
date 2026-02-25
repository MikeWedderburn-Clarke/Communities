/** Shared types for the AcroYoga Community Events platform.
 *  These are framework-agnostic so they can be reused by future mobile clients. */

export const ROLES = ["Base", "Flyer", "Hybrid", "Spotter"] as const;
export type Role = (typeof ROLES)[number];

/** Distribution of roles among RSVPs. */
export type RoleCounts = Record<Role, number>;

// ── API / view models ──────────────────────────────────────────────

export interface EventSummary {
  id: string;
  title: string;
  description: string;
  dateTime: string; // ISO-8601
  endDateTime: string; // ISO-8601
  location: string;
  attendeeCount: number;
  roleCounts: RoleCounts;
}

export interface EventDetail extends EventSummary {
  /**
   * Attendees visible to the current viewer.
   * - Anonymous: empty array
   * - Regular user: only attendees with showName=true (hidden=false),
   *   plus the user's own entry if they RSVP'd with showName=false (hidden=true)
   * - Admin: all attendees; those with showName=false have hidden=true
   */
  visibleAttendees: { name: string; role: Role; hidden: boolean }[];
  /** Whether the current user has already RSVP'd. */
  currentUserRsvp: { role: Role; showName: boolean } | null;
}

export interface RsvpInput {
  eventId: string;
  role: Role;
  showName: boolean;
}

/** Minimal user info returned to the client. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

/** Shared types for the AcroYoga Community Events platform.
 *  These are framework-agnostic so they can be reused by future mobile clients. */

export const ROLES = ["Base", "Flyer", "Hybrid"] as const;
export type Role = (typeof ROLES)[number];

/** Distribution of roles among RSVPs. */
export type RoleCounts = Record<Role, number>;

// ── Location ────────────────────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface CreateLocationInput {
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

// ── API / view models ──────────────────────────────────────────────

export interface EventSummary {
  id: string;
  title: string;
  description: string;
  dateTime: string; // ISO-8601
  endDateTime: string; // ISO-8601
  location: Location;
  attendeeCount: number;
  roleCounts: RoleCounts;
  teacherCount: number;
}

export interface EventDetail extends EventSummary {
  /**
   * Attendees visible to the current viewer.
   * - Anonymous: empty array
   * - Regular user: only attendees with showName=true (hidden=false),
   *   plus the user's own entry if they RSVP'd with showName=false (hidden=true)
   * - Admin: all attendees; those with showName=false have hidden=true
   */
  visibleAttendees: { userId: string; name: string; role: Role; hidden: boolean; isTeaching: boolean; socialLinks: { facebook?: string; instagram?: string; website?: string; youtube?: string } }[];
  /** Whether the current user has already RSVP'd. */
  currentUserRsvp: { role: Role; showName: boolean; isTeaching: boolean } | null;
}

export interface RsvpInput {
  eventId: string;
  role: Role;
  showName: boolean;
  isTeaching: boolean;
}

/** Minimal user info returned to the client. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isTeacherApproved: boolean;
  defaultRole: Role | null;
  defaultShowName: boolean | null;
  homeCity: string | null;
  useCurrentLocation: boolean;
}

/** Full profile for the user's own editing page. */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  isTeacherApproved: boolean;
  teacherRequestedAt: string | null;
  defaultRole: Role | null;
  defaultShowName: boolean | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  youtubeUrl: string | null;
  showFacebook: boolean;
  showInstagram: boolean;
  showWebsite: boolean;
  showYoutube: boolean;
  homeCity: string | null;
  useCurrentLocation: boolean;
}

/** Public profile visible to other logged-in users—only includes links the owner made visible. */
export interface PublicProfile {
  id: string;
  name: string;
  facebookUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  youtubeUrl: string | null;
}

/** Pending teacher request for admin review. */
export interface TeacherRequest {
  userId: string;
  userName: string;
  userEmail: string;
  requestedAt: string; // ISO-8601
}

// ── Event creation / approval ─────────────────────────────────────

export const EVENT_STATUSES = ["approved", "pending", "rejected"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface CreateEventInput {
  title: string;
  description: string;
  dateTime: string; // ISO-8601
  endDateTime: string; // ISO-8601
  locationId: string;
}

/** Pending event for admin review. */
export interface PendingEvent {
  id: string;
  title: string;
  dateTime: string;
  locationName: string;
  createdByName: string;
  createdByEmail: string;
}

// ── Location hierarchy (map view) ────────────────────────────────

export interface VenueGroup {
  venue: string;
  latitude: number;
  longitude: number;
  events: EventSummary[];
  eventCount: number;
}

export interface CityGroup {
  city: string;
  latitude: number;
  longitude: number;
  venues: VenueGroup[];
  eventCount: number;
}

export interface CountryGroup {
  country: string;
  latitude: number;
  longitude: number;
  cities: CityGroup[];
  eventCount: number;
}

export type LocationHierarchy = CountryGroup[];

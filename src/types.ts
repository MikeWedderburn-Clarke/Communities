/** Shared types for the AcroYoga Community Events platform.
 *  These are framework-agnostic so they can be reused by future mobile clients. */

export const ROLES = ["Base", "Flyer", "Hybrid"] as const;
export type Role = (typeof ROLES)[number];

/** Distribution of roles among RSVPs. */
export type RoleCounts = Record<Role, number>;

export const RECURRENCE_FREQUENCIES = ["none", "daily", "weekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "All levels"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** ISO-8601 date inclusive; null means no end date */
  endDate: string | null;
}

export interface EventOccurrence {
  dateTime: string;
  endDateTime: string;
}

// ── Location ────────────────────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  what3names: string | null;
  howToFind: string | null;
}

export interface CreateLocationInput {
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  what3names: string | null;
  howToFind: string | null;
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
  dateAdded: string;
  lastUpdated: string;
  recurrence: RecurrenceRule | null;
  /** Next upcoming occurrence relative to "now" if applicable */
  nextOccurrence: EventOccurrence | null;
  skillLevel: SkillLevel;
  prerequisites: string | null;
  costAmount: number | null;
  costCurrency: string | null;
  concessionAmount: number | null;
  maxAttendees: number | null;
  /** Derived: true when maxAttendees is set and attendeeCount >= maxAttendees */
  isFull: boolean;
  /** Derived: true when nextOccurrence is null (no future occurrence) */
  isPast: boolean;
  /** The logged-in user's own RSVP for this event, or null if not RSVPed */
  userRsvp: { role: Role; paymentStatus: string | null } | null;
  /** ID of the event group this event belongs to, or null */
  groupId: string | null;
  /** Name of the event group, or null */
  groupName: string | null;
  /** True when ticket types exist for this event (ticket-booking flow instead of RSVP) */
  hasTicketTypes: boolean;
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
  /** Ticket types available for this event (empty when RSVP flow is used instead) */
  ticketTypes: TicketType[];
  /** The current user's booking for a ticket covering this event, or null */
  userBooking: Booking | null;
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
  lastLogin: string | null;
  freshSince: string | null;
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
  lastLogin: string | null;
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

// ── Event Groups and Ticketing ────────────────────────────────────

export const BOOKING_PAYMENT_STATUSES = ["pending", "paid", "concession_paid", "comp", "refunded"] as const;
export type BookingPaymentStatus = (typeof BOOKING_PAYMENT_STATUSES)[number];

export const EVENT_GROUP_TYPES = ["festival", "combo", "series"] as const;
export type EventGroupType = (typeof EVENT_GROUP_TYPES)[number];

export const EVENT_GROUP_STATUSES = ["draft", "published"] as const;
export type EventGroupStatus = (typeof EVENT_GROUP_STATUSES)[number];

export interface TicketType {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  costAmount: number;
  costCurrency: string;
  concessionAmount: number | null;
  capacity: number | null;
  /** Derived: count of non-refunded bookings for this ticket type */
  bookedCount: number;
  isAvailable: boolean;
  /** Derived: true when capacity is set and bookedCount >= capacity */
  isSoldOut: boolean;
  sortOrder: number;
  /** Event IDs that this ticket grants access to */
  coveredEventIds: string[];
}

export interface EventGroupSummary {
  id: string;
  name: string;
  description: string | null;
  type: EventGroupType;
  status: EventGroupStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventGroupDetail extends EventGroupSummary {
  memberEvents: {
    eventId: string;
    sortOrder: number;
    title: string;
    dateTime: string;
    endDateTime: string;
  }[];
  ticketTypes: TicketType[];
}

export interface Booking {
  id: string;
  userId: string;
  ticketTypeId: string;
  /** Denormalised for display */
  ticketTypeName: string;
  groupId: string;
  /** Denormalised for display */
  groupName: string;
  role: Role | null;
  showName: boolean;
  isTeaching: boolean;
  paymentStatus: BookingPaymentStatus;
  amountPaid: number | null;
  currency: string | null;
  bookedAt: string;
  cancelledAt: string | null;
  notes: string | null;
}

export interface TeacherSplit {
  id: string;
  ticketTypeId: string;
  /** Denormalised for display */
  ticketTypeName: string;
  teacherUserId: string;
  /** Denormalised for display */
  teacherName: string;
  fixedAmount: number;
  currency: string;
}

export interface TeacherReportLine {
  teacherUserId: string;
  teacherName: string;
  ticketTypeId: string;
  ticketTypeName: string;
  /** Count of bookings with paymentStatus "paid" or "concession_paid" */
  paidBookingCount: number;
  fixedAmountPerBooking: number;
  currency: string;
  /** paidBookingCount * fixedAmountPerBooking */
  totalEarned: number;
}

export interface CreateEventGroupInput {
  name: string;
  description: string | null;
  type: EventGroupType;
}

export interface CreateTicketTypeInput {
  groupId: string;
  name: string;
  description: string | null;
  costAmount: number;
  costCurrency: string;
  concessionAmount: number | null;
  capacity: number | null;
  /** Must contain at least one event ID */
  coveredEventIds: string[];
  sortOrder: number;
}

export interface CreateBookingInput {
  ticketTypeId: string;
  role: Role | null;
  showName: boolean;
  isTeaching: boolean;
}

export interface UpdateBookingStatusInput {
  paymentStatus: BookingPaymentStatus;
  amountPaid: number | null;
  notes: string | null;
}

export interface SetTeacherSplitInput {
  ticketTypeId: string;
  teacherUserId: string;
  fixedAmount: number;
  currency: string;
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
  recurrence: RecurrenceRule | null;
  skillLevel: SkillLevel;
  prerequisites: string | null;
  costAmount: number | null;
  costCurrency: string | null;
  concessionAmount: number | null;
  maxAttendees: number | null;
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

export interface ContinentGroup {
  continent: string;
  latitude: number;
  longitude: number;
  countries: CountryGroup[];
  eventCount: number;
}

export type LocationHierarchy = ContinentGroup[];

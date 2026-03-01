# Changelog

All notable changes to this project are documented here.

---

## 2026-03-01

- `RecurrenceFrequency`, `RecurrenceRule`, and `EventOccurrence` types added to `src/types.ts`
- `recurrence: RecurrenceRule | null` field added to `CreateEventInput`
- `recurrence` and `nextOccurrence` fields added to `EventSummary`
- `dateAdded` and `lastUpdated` fields added to `EventSummary`
- `lastLogin: string | null` added to `SessionUser` and `UserProfile`
- `what3names: string | null` and `howToFind: string | null` added to `Location` and `CreateLocationInput`
- `computeNextOccurrence()` — advances a recurring event to its next future occurrence, with a 2 000-iteration safety guard (`src/lib/recurrence.ts`)
- `formatRecurrenceSummary()` — human-readable label e.g. "Repeats weekly until 1 Jun 2026" (`src/lib/recurrence.ts`)
- `isEventFresh()` — returns true when an event was added or updated more recently than the viewer's last login (`src/lib/event-utils.ts`)
- `normalizeCityName()` — canonical city name lookup with alias table for London variants, NYC, SF etc. (`src/lib/city-utils.ts`)
- `buildExternalMapLinks()` — generates Google Maps, Apple Maps, OpenStreetMap, and What3Names links for a set of coordinates (`src/lib/map-links.ts`)
- `EventsHierarchy` component — Globe → Country → City → Venue drill-down list view (`src/app/events/events-hierarchy.tsx`)
- `BreadcrumbNav` component — breadcrumb trail rendered above the hierarchy (`src/app/events/breadcrumbs.tsx`)
- `EventCard` component — individual event entry with role counts, recurrence summary, and freshness badges (`src/app/events/event-card.tsx`)
- `src/app/events/create/layout.tsx` — wraps the create-event page with a consistent heading
- Event creation form: recurrence schedule UI (none / daily / weekly / monthly + optional end date), with end-date clamped to be ≥ start date
- What3names and directions fields added to the Create Event → Add New Location form
- "New" (green) and "Updated" (amber) freshness badges shown on event cards and the event detail page
- Event detail page: breadcrumb nav with `?from=map` / `?from=list` back-links, recurrence summary, external map link buttons, freshness badge, and `nextOccurrence` used for display date/time
- Hierarchy list view replaces flat `EventsList` as the default; hierarchy auto-opens to the user's home city
- Events query expanded: now fetches `recurrenceType`, `recurrenceEndDate`, `what3names`, `howToFind`, `dateAdded`, and `lastUpdated` in the same join
- `finalizeEventSummaries()` helper: attaches `nextOccurrence`, filters out fully-elapsed events, sorts by next occurrence date
- Validation: full recurrence rule validation (frequency enum, ISO end date, end date ≥ start date) and `what3names` / `howToFind` validation for location creation
- New test file `src/__tests__/recurrence.test.ts` — 6 tests covering `formatRecurrenceSummary`
- TypeScript errors fixed in `location-hierarchy.test.ts`, `profile.test.ts`, and `visibility.test.ts`; `tsc --noEmit` now clean
- `.gitignore`: added `*.db-shm`, `*.db-wal`, `tsconfig.tsbuildinfo` to prevent WAL files and build artifacts from being staged
- `copilot-instructions.md` overhauled: added Tech stack, Implemented features, Not yet built, and Architecture conventions sections; post-change cycle updated to include `tsc --noEmit` and use `npm run db:seed`; Git workflow expanded to 6 steps including changelog maintenance rule
- `CHANGELOG.md` created; all history back-filled and grouped by calendar day

---

## 2026-02-27

- Replaced free-scroll Leaflet map with three discrete zoom levels: Globe (zoom 2, indigo country bubbles), Country (zoom 5, sky-blue city bubbles), City (zoom 12, green event-title pills)
- Clicking a country or city bubble drills directly to that level; clicking an event pill opens the event page
- Zoom In / Zoom Out buttons navigate one level at a time; scroll-wheel zoom, double-click zoom, and +/− controls disabled
- Breadcrumb indicator (Globe › Country › City) shows current map level
- Swapped OpenStreetMap tiles for CartoDB Positron (clean, no API key required)
- Removed MarkerClusterGroup and popups

---

## 2026-02-26

- `homeCity` and `useCurrentLocation` columns added to the `users` table
- Profile page: home city text field + browser geolocation button with Nominatim reverse geocoding to auto-fill city name; `useCurrentLocation` toggle detects city on page load when enabled
- Events page: city filter dropdown defaulting to the user's home city; `?city=` query-param override supported
- Map view centres on home-city venues when a home city is set
- Seed data expanded: 7 new locations and 10 new events across New York, Bristol, and Bournemouth
- Re-added `react-leaflet-cluster` for automatic marker clustering on zoom out
- Create Event → Add Location: Nominatim geocoding search auto-fills name, city, country, lat/lng; all fields reset on cancel or successful create
- New API routes: `POST /api/events`, `GET /api/locations`, `POST /api/locations`, `POST /api/admin/approve-event`
- `next.config.ts`: `serverExternalPackages` configured for Leaflet SSR compatibility
- N+2 → 1 query: event list and RSVPs now fetched in a single `LEFT JOIN`
- DB index added on `events(status, dateTime)` for faster upcoming-events lookups
- RSVP upsert: `INSERT OR REPLACE` replaces the previous delete-then-insert pair
- Admin page: teacher-approval and pending-events queries now run in parallel via `Promise.all`

---

## 2026-02-25

- Next.js 15.5 project scaffolded with TypeScript, Tailwind CSS v4, Drizzle ORM, Vitest, ESLint, and path aliases
- Database schema: `users`, `locations`, `events`, `rsvps` tables with foreign keys and unique constraints
- Shared TypeScript types: `EventSummary`, `EventDetail`, `Location`, `Role`, `RsvpInput`, etc. in `src/types.ts`
- Service layer: `events.ts` (list, detail, create, approve, RSVP), `ics.ts` (RFC 5545 calendar generation), `validation.ts` (server-side input validation)
- Mock cookie-based auth: login page lets user pick a test user; `getCurrentUser()` reads session from cookie
- Events UI: `/events` list page, `/events/[id]` detail page with RSVP form, shared `RoleBadges` component
- API routes: `POST /api/rsvp`, `DELETE /api/rsvp`, `GET /events/[id]/calendar.ics`
- `isAdmin` boolean column added to `users`; seed user Dan is the admin
- Admin visibility: admins see all attendees including those with `showName = false`
- Self-visibility: users see their own hidden RSVP entry with a "hidden" tag
- Login page shows an admin badge for admin accounts
- `better-sqlite3` externalised in `next.config.ts`; `/login` marked dynamic to fix production build
- User profile page (`/profile`): edit RSVP defaults, social links (Facebook, Instagram, website, YouTube) with per-platform visibility toggles
- Public profile page (`/profile/[id]`): shows only links the owner made public
- Teacher workflow: users request teacher status; admins approve/deny from the Admin Alerts page
- Social brand icons shown next to attendees on the event detail page
- `buildLocationHierarchy()` in `src/lib/location-hierarchy.ts`: groups events by country → city → venue
- Map views: interactive Leaflet map and hierarchy card view; 3-way toggle on the events page
- API routes: `POST /api/profile`, `POST /api/teacher-request`, `POST /api/admin/approve-teacher`
- Initial seed: 4 users, 5 locations, 5 London-based events, 9 RSVPs
- Unit tests: 33 tests across `events.test.ts`, `visibility.test.ts`, `validation.test.ts`, `ics.test.ts`
- README: setup instructions, architecture overview, test/build commands

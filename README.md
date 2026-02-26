# Communities

An AcroYoga community events platform — browse events, RSVP with your role, and add events to your calendar.

## Quick start

```bash
npm install
npm run db:seed   # creates community.db with sample London events
npm run dev       # starts dev server at http://localhost:3000
```

## Restart

```bash
rm -f community.db community.db-shm community.db-wal && npx tsx src/db/seed.ts && npm run dev
```

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:seed` | Seed database with sample data |

## Project structure

```
src/
├── types.ts                     # Shared types (contract-first, reusable for mobile)
├── db/
│   ├── schema.ts                # Drizzle ORM schema (users, locations, events, rsvps)
│   ├── index.ts                 # DB connection (SQLite + WAL mode)
│   ├── seed.ts                  # Seed script with London AcroYoga events
│   └── test-utils.ts            # In-memory DB factory for tests
├── services/
│   ├── events.ts                # Business logic: queries, role aggregation, visibility, event approval
│   ├── ics.ts                   # ICS calendar file generation
│   ├── locations.ts             # Location CRUD + search
│   ├── users.ts                 # User profile queries & validation
│   └── validation.ts            # Server-side input validation
├── lib/
│   ├── auth.ts                  # Mock auth (TODO: replace with real auth)
│   └── location-hierarchy.ts    # Country > City > Venue grouping for map views
├── components/
│   ├── header.tsx               # Nav bar with auth state + admin badge
│   ├── role-badges.tsx          # Role distribution badges
│   └── social-icons.tsx         # Social link icons (Facebook, Instagram, etc.)
├── app/
│   ├── page.tsx                 # Home page
│   ├── login/page.tsx           # Mock login (user picker)
│   ├── logout/route.ts          # Logout handler
│   ├── events/
│   │   ├── page.tsx             # Events list (public, 3-way view toggle)
│   │   ├── events-content.tsx   # Client component: list/map view switcher
│   │   ├── events-list.tsx      # Card-based event list
│   │   ├── leaflet-map.tsx      # Interactive Leaflet map with venue markers
│   │   ├── map-view.tsx         # Text-based drill-down map (Country > City > Venue)
│   │   ├── create/page.tsx      # Event creation form with location picker
│   │   └── [id]/
│   │       ├── page.tsx         # Event detail + RSVP
│   │       ├── rsvp-form.tsx    # RSVP client component
│   │       └── calendar.ics/route.ts  # ICS download
│   ├── profile/
│   │   ├── page.tsx             # Own profile editor
│   │   ├── profile-form.tsx     # Profile form (defaults, social links, teacher request)
│   │   └── [id]/page.tsx        # Public profile view
│   ├── admin/
│   │   └── alerts/page.tsx      # Admin dashboard (teacher + event approvals)
│   └── api/
│       ├── rsvp/route.ts        # RSVP API (POST/DELETE)
│       ├── events/route.ts      # Event creation API (POST)
│       ├── admin/
│       │   ├── approve-teacher/route.ts  # Teacher approval API
│       │   └── approve-event/route.ts    # Event approval API
│       ├── locations/route.ts   # Location search & creation API
│       ├── profile/route.ts     # Profile update API
│       └── teacher-request/route.ts      # Teacher request API
└── __tests__/                   # Unit + integration tests
```

## Auth

The current auth is a **mock layer** for development — it uses a cookie with a user ID and a login page that lets you pick from seeded test users. Look for `TODO` comments in `src/lib/auth.ts` for guidance on replacing it with real authentication (e.g. NextAuth.js with email magic links).

## Visibility rules

- **Public** (no login): approved event details, attendee count, role distribution
- **Logged-in users**: above + names of attendees who opted in (`showName: true`)
- **Never public**: email addresses, pending/rejected events

## Event creation

Any logged-in user can submit an event. Events created by **admins** are automatically approved and visible immediately. Events created by **non-admin users** are held for admin review — admins can approve or reject them from the Admin Alerts page.

## Tech stack

- **Next.js 15** (App Router, Server Components)
- **TypeScript**
- **SQLite** + **Drizzle ORM** (file-based, zero-config)
- **Tailwind CSS v4**
- **Vitest** (unit + integration tests)
- **Leaflet** + **react-leaflet** (interactive map with venue markers + OpenStreetMap tiles)

# Project Structure

```
src/
├── types.ts                     # Shared types (contract-first, reusable for mobile)
├── auth.ts                      # NextAuth config
├── db/
│   ├── schema.ts                # Drizzle ORM schema (users, locations, events, rsvps)
│   ├── index.ts                 # DB connection (PostgreSQL via pg pool)
│   ├── seed.ts                  # Seed script with sample AcroYoga events
│   └── test-utils.ts            # In-memory PGlite factory for tests
├── services/
│   ├── events.ts                # Business logic: queries, role aggregation, visibility, approval
│   ├── bookings.ts              # Booking / RSVP service
│   ├── event-groups.ts          # Event group management
│   ├── ticket-types.ts          # Ticket type management
│   ├── teacher-splits.ts        # Teacher revenue splits
│   ├── ics.ts                   # ICS calendar file generation
│   ├── locations.ts             # Location CRUD + search
│   ├── users.ts                 # User profile queries & validation
│   └── validation.ts            # Server-side input validation
├── lib/
│   ├── auth.ts                  # Auth helpers (getCurrentUser)
│   ├── location-hierarchy.ts    # Country > City > Venue grouping
│   ├── day-utils.ts             # Day-of-week colours and ordering
│   ├── event-utils.ts           # Event freshness detection
│   └── city-utils.ts            # City name normalisation
├── components/
│   ├── header.tsx               # Nav bar with auth state + admin badge
│   ├── role-badges.tsx          # Role distribution badges
│   ├── ticket-selector.tsx      # Ticket type selection UI
│   └── social-icons.tsx         # Social link icons
└── app/
    ├── page.tsx                 # Home page
    ├── login/page.tsx           # Login page
    ├── logout/route.ts          # Logout handler
    ├── events/
    │   ├── page.tsx             # Events page (public, list/map/combined views)
    │   ├── events-content.tsx   # Client component: filter + view logic
    │   ├── events-hierarchy.tsx # Hierarchy list view (Globe→Country→City→Venue)
    │   ├── events-combined.tsx  # Combined tree+map split view
    │   ├── event-card.tsx       # Event card component
    │   ├── leaflet-map.tsx      # Interactive Leaflet map
    │   ├── breadcrumbs.tsx      # Hierarchy breadcrumb nav
    │   ├── create/page.tsx      # Event creation form
    │   └── [id]/
    │       ├── page.tsx         # Event detail + RSVP
    │       └── calendar.ics/route.ts  # ICS download
    ├── groups/[id]/             # Event group pages
    ├── admin/
    │   ├── alerts/page.tsx      # Admin dashboard
    │   └── groups/              # Group management
    ├── profile/
    │   ├── page.tsx             # Own profile editor
    │   └── [id]/page.tsx        # Public profile view
    └── api/                     # API route handlers
```

## Key design principles

- **`src/types.ts`** is the single source of truth for shared types — always define or update types here first
- **`src/services/`** contains all business logic — API route handlers only parse input, call a service, and return a response
- **`src/db/schema.ts`** contains the Drizzle ORM schema — generate a migration with `npm run db:generate` after any schema change
- **React Server Components** are the default — add `"use client"` only when a component needs state, effects, or browser APIs
- **Tests** live in `src/__tests__/` and use the in-memory PGlite factory from `src/db/test-utils.ts`

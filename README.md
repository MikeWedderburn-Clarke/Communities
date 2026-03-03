# Communities

An AcroYoga community events platform — browse events, RSVP with your role, and add events to your calendar.

## Prerequisites

- **Node.js 22+**
- **Docker** (for local PostgreSQL)

## Quick start

```bash
# 1. Start PostgreSQL (data persists across restarts via named Docker volume)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Copy env template and fill in values
cp .env.local.example .env.local
# The defaults in .env.local.example match docker-compose.yml — no changes needed for local dev

# 4. Apply schema migrations
npm run db:migrate

# 5. Seed with sample events
npm run db:seed

# 6. Start dev server
npm run dev
# → http://localhost:3000
```

## Local database management

| Command | Description |
|---|---|
| `docker compose up -d` | Start Postgres in background (data persists) |
| `docker compose down` | Stop Postgres (data kept) |
| `docker compose down -v` | Stop and **delete all data** |
| `npm run db:migrate` | Apply any new Drizzle migrations |
| `npm run db:seed` | Seed with sample AcroYoga events |
| `npm run db:dump` | Dump local DB to `backup.dump` |
| `npm run db:restore` | Restore local DB from `backup.dump` |

### Fresh start (wipe and reseed)

```bash
docker compose down -v && docker compose up -d && npm run db:migrate && npm run db:seed
```

### Push local data to Azure (manual sync)

```bash
# 1. Dump from the local Docker container
npm run db:dump

# 2. Restore into Azure Postgres
# Set AZURE_DATABASE_URL in .env.local (see .env.local.example), then:
docker exec -i communities-db pg_restore \
  -d "$AZURE_DATABASE_URL" --no-owner --clean --if-exists < backup.dump
```

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:generate` | Generate new Drizzle migration from schema diff |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:dump` | Dump DB to backup.dump |
| `npm run db:restore` | Restore DB from backup.dump |

## Project structure

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

## Auth

Authentication uses **NextAuth.js**. For local development, set `MOCK_AUTH=true` in `.env.local` to enable a dev user-picker login page that lets you switch between seeded test users without passwords.

For production, configure Microsoft Entra External ID (see `.env.local.example` for the required variables).

## Event visibility rules

- **Public** (no login): approved event details, attendee count, role distribution
- **Logged-in users**: above + names of attendees who opted in (`showName: true`)
- **Never public**: email addresses, pending/rejected events

## Event creation

Any logged-in user can submit an event. Events created by **admins** are automatically approved. Events from non-admin users are held for admin review — approve or reject from the **Admin Alerts** page.

## Tech stack

- **Next.js 15** (App Router, Server Components)
- **TypeScript** (strict mode)
- **PostgreSQL** via `pg` (node-postgres) + **Drizzle ORM**
- **Tailwind CSS v4**
- **NextAuth.js v5**
- **Vitest** (unit + integration tests with in-memory PGlite)
- **Leaflet** + **react-leaflet** (interactive map — Globe→Country→City drill-down)

## Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) on push to `main`:

1. Builds a Docker image and pushes to Azure Container Registry
2. Runs `db:migrate` against Azure Postgres
3. Deploys to Azure Container Apps

Required GitHub **secrets**: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `DATABASE_URL`

Required GitHub **variables**: `AZURE_REGISTRY`, `AZURE_APP_NAME`, `AZURE_RESOURCE_GROUP`

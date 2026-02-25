# Communities

An AcroYoga community events platform — browse events, RSVP with your role, and add events to your calendar.

## Quick start

```bash
npm install
npm run db:seed   # creates community.db with sample London events
npm run dev       # starts dev server at http://localhost:3000
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
├── types.ts              # Shared types (contract-first, reusable for mobile)
├── db/
│   ├── schema.ts         # Drizzle ORM schema (users, events, rsvps)
│   ├── index.ts          # DB connection (SQLite + WAL mode)
│   ├── seed.ts           # Seed script with London AcroYoga events
│   └── test-utils.ts     # In-memory DB factory for tests
├── services/
│   ├── events.ts         # Business logic: queries, role aggregation, visibility
│   ├── ics.ts            # ICS calendar file generation
│   └── validation.ts     # Server-side input validation
├── lib/
│   └── auth.ts           # Mock auth (TODO: replace with real auth)
├── components/
│   ├── header.tsx        # Nav bar with auth state
│   └── role-badges.tsx   # Role distribution badges
├── app/
│   ├── page.tsx          # Home page
│   ├── login/page.tsx    # Mock login (user picker)
│   ├── logout/route.ts   # Logout handler
│   ├── events/
│   │   ├── page.tsx      # Events list (public)
│   │   └── [id]/
│   │       ├── page.tsx      # Event detail + RSVP
│   │       ├── rsvp-form.tsx # RSVP client component
│   │       └── calendar.ics/route.ts  # ICS download
│   └── api/
│       └── rsvp/route.ts # RSVP API (POST/DELETE)
└── __tests__/            # Unit + integration tests
```

## Auth

The current auth is a **mock layer** for development — it uses a cookie with a user ID and a login page that lets you pick from seeded test users. Look for `TODO` comments in `src/lib/auth.ts` for guidance on replacing it with real authentication (e.g. NextAuth.js with email magic links).

## Visibility rules

- **Public** (no login): event details, attendee count, role distribution
- **Logged-in users**: above + names of attendees who opted in (`showName: true`)
- **Never public**: email addresses

## Tech stack

- **Next.js 15** (App Router, Server Components)
- **TypeScript**
- **SQLite** + **Drizzle ORM** (file-based, zero-config)
- **Tailwind CSS v4**
- **Vitest** (unit + integration tests)

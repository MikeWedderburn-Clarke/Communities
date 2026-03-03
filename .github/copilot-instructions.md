# Copilot Instructions — AcroYoga Community Events Platform (Web-first)

## Product goal
Build a public, SEO-friendly events platform for the worldwide AcroYoga community.
Web app first for iteration; keep architecture open so iOS/Android clients can be added later.

## Tech stack
- **Framework:** Next.js 15, App Router, React Server Components by default
- **Database:** PostgreSQL via `pg` (node-postgres), managed with Drizzle ORM. Local dev uses Docker Compose (`docker compose up -d`); production uses Azure Database for PostgreSQL.
- **Styling:** Tailwind CSS v4
- **Maps:** Leaflet + react-leaflet + react-leaflet-cluster
- **Testing:** Vitest with in-memory PGlite (helpers in `src/db/test-utils.ts`)
- **TypeScript:** strict mode; `tsc --noEmit` must pass cleanly before every commit

## Implemented features
- Public events list + event detail pages (no login required to browse)
- RSVP requires login; captures role: Base / Flyer / Hybrid
- Public view shows attendee counts + role mix; names only shown for users who opt in
- "Add to calendar" via generated .ics file per event
- Social sharing via share link (user-mediated; no platform API integration)
- User profiles: RSVP defaults, social links (Facebook, Instagram, website, YouTube) with per-platform visibility toggles
- Teacher status: users request approval; admins review and approve/deny
- Admin role: approve/reject pending events; approve/deny teacher requests; see all attendees including hidden-name
- Recurring events: daily / weekly / monthly with optional end date; `nextOccurrence` computed at query time
- Map views: interactive Leaflet map (Globe → Continent → Country → City drill-down), hierarchy list view (Globe → Continent → Country → City → Venue), and combined split tree+map view
- Home city: profile preference + browser geolocation; events page defaults to home city filter
- Event freshness badges: "New" / "Updated" shown for events added or changed since the viewer's last login; map bubbles and hierarchy nodes tint blue when child events are fresh
- External map links on event detail: Google Maps, Apple Maps, OpenStreetMap, What3Names
- Nominatim geocoding in the Add Location form (search → auto-fill name, city, country, lat/lng); What3Words and directions fields on locations
- Skill level picker (Beginner / Intermediate / Advanced / All levels) on event creation; colour-coded badge on event detail
- Prerequisites free-text field on event creation (auto-inserts `• ` bullet on Enter); displayed as amber card on event detail; RSVP form requires attendees to tick a confirmation checkbox
- Cost and optional concession cost on event creation (amount + currency picker); displayed in RSVP section; `formatCost()` uses `Intl.NumberFormat` for locale-aware currency formatting
- Status filter pills (New / Full / Past / Booked / To Pay) with OR-logic; colour-coded event cards (orange = past, red = full, blue = new/updated, yellow = to pay, green = booked)
- Calendar range picker: dual-month date range selection filter on the events page
- Authentication: NextAuth.js v5 with Microsoft Entra External ID for production; set `MOCK_AUTH=true` in `.env.local` for local dev user-picker (no passwords)
- CI/CD: GitHub Actions workflow builds Docker image → pushes to Azure Container Registry → runs `db:migrate` → deploys to Azure Container Apps on every push to `main`
- Event Groups: named containers (type: festival / combo / series) linking multiple events; public group page at `/groups/[id]` shows tickets and member events; admin group management at `/admin/groups`
- Ticket Types: per-group ticket definitions with cost, capacity, and concession pricing; independent capacity pools per ticket type
- Bookings: ticket purchase with payment status tracking (pending / paid / concession_paid / comp / refunded)
- Teacher Revenue Splits: fixed amount per teacher per ticket type; admin teacher earnings report at `/admin/groups/[id]/teacher-report`

## Not yet built
- **Payment processing** — cost/concession fields are stored and displayed, but no payment gateway (Stripe etc.) is integrated; the cost fields are a data foundation for a future payments feature.
- **Email notifications** — no emails sent for event approvals, RSVP confirmations, or teacher decisions
- **Rate limiting** — API endpoints have no request throttling
- **Image uploads** — events and profiles have no photos; no blob storage configured
- **Share card generation** — share-by-link works; dynamic OG image / visual share card does not exist yet
- **Event series management UI** — recurrence logic and DB fields exist; no UI to edit or cancel a whole series

## Architecture conventions
- `src/types.ts` is the single source of truth for shared types — define or update types here first, before implementing
- Business logic belongs in `src/services/`; API route handlers should only parse input, call a service function, and return a response
- React Server Components by default; add `"use client"` only when a component needs state, effects, or browser APIs
- New integration tests should use `createTestDb()` from `src/db/test-utils.ts` for an isolated in-memory database
- The auth helper is `getCurrentUser()` in `src/lib/auth.ts`; production uses NextAuth v5 with Microsoft Entra External ID; local dev uses mock user-picker when `MOCK_AUTH=true`

## Engineering principles
- Contract-first APIs: define types/schemas centrally in `src/types.ts` to reuse later for mobile clients.
- Do not leak PII in public endpoints.
- Validate inputs server-side.
- Prefer small, testable changes; add unit tests for core business rules.
- Keep dependencies minimal; keep README up to date.

## Agent instructions
- If you have any questions, ask them before starting the task.
- Whenever you have finished a task, say **Finished** and then summarise the changes you have made. Suggest ways to test the changes in the UI.
- If you are unsure about how to implement a feature, ask for clarification before proceeding.
- If you encounter an error, try to debug it and fix it. If you are unable to fix it, ask for help and provide details about the error and what you have tried.
- If you are asked to write tests, make sure to cover edge cases and validate core business rules.
- After every code update, run the full post-change cycle in this exact order:
  ```
  npm run test && npx tsc --noEmit && npm run build && npm run dev
  ```
- To start a completely fresh local database (wipe all data and reseed):
  ```
  docker compose down -v && docker compose up -d && npm run db:migrate && npm run db:seed
  ```
- Once `npm run dev` is up, pre-warm the app by requesting the landing page and key routes (e.g. `curl http://localhost:3000/`, `/events`, and one event detail) so caches and ISR paths are ready.

## Git workflow — run after every completed task

### Before starting a task
Run `git pull --rebase origin main` to integrate any upstream changes before making new edits. Resolve any conflicts before proceeding.

### After passing the full post-change cycle (tests + type-check + build + seed + dev)
Execute the following steps in order. Do not skip any step.

1. **Review status**
   Run `git status` and confirm which files are modified, which are new, and which are untracked.

2. **Stage changes**
   Stage tracked modifications and explicitly named new source files only:
   ```
   git add -u
   git add <any new source files that belong in the repo>
   ```
   Never use `git add .` or `git add *`.
   Never stage: `community.db`, `community.db-shm`, `community.db-wal`, `tsconfig.tsbuildinfo`, anything under `.next/`, `node_modules/`.

3. **Verify the diff**
   Run `git diff --staged` and confirm only intended source changes are included. If anything unexpected is staged, unstage it with `git restore --staged <file>`.

4. **Commit**
   Use an imperative subject line ≤ 72 characters with a conventional prefix:
   `feat:` new feature · `fix:` bug fix · `perf:` performance · `test:` tests · `chore:` tooling/deps · `refactor:` restructuring without behaviour change.
   Include a short bullet body when the change is non-trivial. Always append the co-author trailer:
   ```
   git commit -m "$(cat <<'EOF'
   feat: short imperative description

   - bullet summarising what changed and why
   - second bullet if needed

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

5. **Update the changelog**
   Edit `CHANGELOG.md` before pushing:
   - Use the format `## YYYY-MM-DD` (today's date, UTC).
   - If an entry for today already exists, append new bullet points to it — do not create a second entry for the same date.
   - Write each change as a single concise bullet. No sub-headings, no time-of-day qualifiers.
   - Move any items from `## [Unreleased]` that are now committed into the dated entry and remove them from `[Unreleased]`. If `[Unreleased]` becomes empty, remove it.
   - Stage the updated `CHANGELOG.md` and amend it into the same commit: `git add CHANGELOG.md && git commit --amend --no-edit`.

6. **Push**
   Run `git push origin main` and confirm the push succeeds before reporting the task as finished.

### After a successful push, report
- The commit hash and subject line.
- Files changed (additions / deletions).
- Any follow-up actions the user should take.

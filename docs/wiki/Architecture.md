# Architecture

## Conventions

- **`src/types.ts`** is the single source of truth for all shared types. Define or update types here first, before implementing features.
- **`src/services/`** contains all business logic. API route handlers should only parse input, call a service function, and return a response.
- **React Server Components** are the default. Add `"use client"` only when a component needs state, browser events, or browser APIs.
- **Integration tests** use `createTestDb()` from `src/db/test-utils.ts` for an isolated in-memory PGlite database — no Docker required for tests.
- **Auth** — use `getCurrentUser()` from `src/lib/auth.ts` to get the current user in any Server Component or API route.

## Engineering principles

- **Contract-first APIs** — define types centrally in `src/types.ts` so they can be reused by future mobile clients without re-negotiation.
- **No PII in public endpoints** — email addresses and hidden RSVP names must never appear in responses to unauthenticated requests.
- **Server-side validation** — all user input is validated in `src/services/validation.ts` before reaching the database.
- **Small, testable changes** — add unit tests for core business rules; prefer isolated service functions over complex page logic.
- **Minimal dependencies** — add a new package only when it clearly saves significant work; prefer what's already in the stack.

## What's not yet built

The following are known gaps — contributions welcome:

- **Payment processing** — cost fields are stored and displayed, but no payment gateway (Stripe etc.) is integrated.
- **Email notifications** — no emails are sent for event approvals, RSVP confirmations, or teacher decisions.
- **Rate limiting** — API endpoints have no request throttling.
- **Image uploads** — events and profiles have no photos; no blob storage configured.
- **Share card generation** — share-by-link works; dynamic OG image generation does not.
- **Event series management UI** — recurrence logic and DB fields exist; no UI to edit or cancel a whole series.

## Adding a feature — checklist

1. Update or add types in `src/types.ts`
2. If the DB schema changes, edit `src/db/schema.ts` and run `npm run db:generate`
3. Add business logic in `src/services/`
4. Add or update API routes in `src/app/api/`
5. Add or update UI in `src/app/` (Server Components by default)
6. Write tests in `src/__tests__/` using `createTestDb()`
7. Run `npm run test && npx tsc --noEmit && npm run build` and fix any failures
8. Update `CHANGELOG.md` before committing

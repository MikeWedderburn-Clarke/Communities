# Copilot Instructions — AcroYoga Community Events Platform (Web-first)

## Product goal
Build a public, SEO-friendly events platform for AcroYoga London that can scale worldwide.
Web app first for iteration; keep architecture open so iOS/Android clients can be added later.

## Core requirements (MVP)
- Public events list + event detail pages (no login required to browse).
- RSVP requires login.
- RSVP captures role: Base / Flyer / Hybrid / Spotter.
- Public view shows attendee counts + role mix; names are only shown for users who opt in.
- “Add to calendar” via generated .ics file per event.
- Social sharing is user-mediated (share link, generate share card); do not integrate platform APIs.

## Engineering principles
- Contract-first APIs: define types/schemas centrally to reuse later for mobile clients.
- Do not leak PII in public endpoints.
- Validate inputs server-side.
- Prefer small, testable changes; add unit tests for core business rules.
- Keep dependencies minimal; keep README up to date.
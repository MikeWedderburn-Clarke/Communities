# Copilot Instructions — AcroYoga Community Events Platform (Web-first)

## Product goal
Build a public, SEO-friendly events platform for AcroYoga London that can scale worldwide.
Web app first for iteration; keep architecture open so iOS/Android clients can be added later.

## Core requirements (MVP)
- Public events list + event detail pages (no login required to browse).
- RSVP requires login.
- RSVP captures role: Base / Flyer / Hybrid.
- Public view shows attendee counts + role mix; names are only shown for users who opt in.
- “Add to calendar” via generated .ics file per event.
- Social sharing is user-mediated (share link, generate share card); do not integrate platform APIs.

## Engineering principles
- Contract-first APIs: define types/schemas centrally to reuse later for mobile clients.
- Do not leak PII in public endpoints.
- Validate inputs server-side.
- Prefer small, testable changes; add unit tests for core business rules.
- Keep dependencies minimal; keep README up to date.

## Agent instructions
- Whenever you have finished a task, say Finished and then summarise the changes the changes that you have made. If you have any questions, ask them before starting the task.
- If you are unsure about how to implement a feature, ask for clarification before proceeding.
- If you encounter an error, try to debug it and fix it. If you are unable to fix it, ask for help and provide details about the error and what you have tried.
- If you are asked to write tests, make sure to cover edge cases and validate core business rules.
- Restart the dev server after making changes to ensure that everything is working correctly.
- Check in changes to version control after completing a task, and provide a summary of the changes in the commit message. Use GitHub best practices to get status, pull with rebase, stage all appropriate files, and commit with a clear message.

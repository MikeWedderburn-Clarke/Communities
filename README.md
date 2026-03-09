# Communities

A public, SEO-friendly events platform for the worldwide AcroYoga community — discover events on an interactive map, RSVP with your role, explore festivals and series, and sync events to your calendar.

> **Status:** Active development &nbsp;·&nbsp; [What's new →](CHANGELOG.md)

## ✨ Features

- **Browse events** — list, interactive map (Globe → Continent → Country → City), and combined tree+map view
- **RSVP** — register your role (Base / Flyer / Hybrid) with skill level and prerequisites awareness
- **Event Groups** — festivals, combos, and series with ticket types, capacity pools, and booking tracking
- **Recurring events** — daily / weekly / monthly with smart next-occurrence computation
- **Teacher workflow** — request teacher status; admins approve/deny and view earnings reports
- **Admin tools** — approve events, manage groups, see all attendees including hidden-name entries
- **Personalisation** — home city preference, social links, per-event calendar export (.ics)
- **Freshness badges** — "New" / "Updated" highlights events added or changed since your last login

## 🚀 Quick start

**Requires Node.js 22+ and Docker.**

```bash
docker compose up -d           # start PostgreSQL (creates both `communities` and `communities_test`)
npm install                    # install dependencies
cp .env.local.example .env.local
npm run db:migrate             # apply schema to live db
npm run db:seed                # seed live db with sample data
npm run db:migrate-test        # apply schema to test db
npm run db:seed-test           # seed test db with comprehensive test data
npm run dev                    # → http://localhost:3000
```

> Set `MOCK_AUTH=true` in `.env.local` to use the dev user-picker (no passwords needed).
>
> Admins can toggle between the live and test databases using the **LIVE DB / TEST DB** button in the top navigation bar. A yellow banner appears while test mode is active.

## 📖 Documentation

| Topic | Link |
|---|---|
| Local setup, database commands, npm scripts | [Wiki: Local Development](../../wiki/Local-Development) |
| Source directory layout | [Wiki: Project Structure](../../wiki/Project-Structure) |
| Mock auth and Entra ID production setup | [Wiki: Authentication](../../wiki/Authentication) |
| Azure Container Apps deployment | [Wiki: Deployment](../../wiki/Deployment) |
| Architecture conventions and contributing | [Wiki: Architecture](../../wiki/Architecture) |
| Full change history | [CHANGELOG.md](CHANGELOG.md) |
| Planned and in-progress work | [Project Board](../../projects) |

## 🛠 Tech stack

Next.js 15 (App Router) · TypeScript (strict) · PostgreSQL + Drizzle ORM · Tailwind CSS v4 · NextAuth.js v5 · Leaflet · Vitest

## 📄 License

[MIT](LICENSE)

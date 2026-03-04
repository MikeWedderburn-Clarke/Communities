# Local Development

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

> Set `MOCK_AUTH=true` in `.env.local` to enable the dev user-picker login page (no passwords required). See [Authentication](Authentication) for details.

## Fresh start (wipe and reseed)

```bash
docker compose down -v && docker compose up -d && npm run db:migrate && npm run db:seed
```

## Database management

| Command | Description |
|---|---|
| `docker compose up -d` | Start Postgres in background (data persists) |
| `docker compose down` | Stop Postgres (data kept) |
| `docker compose down -v` | Stop and **delete all data** |
| `npm run db:migrate` | Apply any new Drizzle migrations |
| `npm run db:seed` | Seed with sample AcroYoga events |
| `npm run db:dump` | Dump local DB to `backup.dump` |
| `npm run db:restore` | Restore local DB from `backup.dump` |

## Push local data to Azure (manual sync)

```bash
# 1. Dump from the local Docker container
npm run db:dump

# 2. Restore into Azure Postgres
# Set AZURE_DATABASE_URL in .env.local (see .env.local.example), then:
docker exec -i communities-db pg_restore \
  -d "$AZURE_DATABASE_URL" --no-owner --clean --if-exists < backup.dump
```

## Available npm scripts

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
| `npm run db:dump` | Dump DB to `backup.dump` |
| `npm run db:restore` | Restore DB from `backup.dump` |

## Post-change validation cycle

After any code change, run this sequence in order before committing:

```bash
npm run test && npx tsc --noEmit && npm run build && npm run dev
```

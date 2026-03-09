import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "dotenv";
import * as schema from "./schema";

// Load .env.local for standalone scripts (seed, migrate). In the Next.js app
// and in CI, DATABASE_URL is already set; dotenv will not override it.
config({ path: ".env.local", override: false });

// Use a global singleton to prevent multiple pool instances during Next.js hot reloads.
declare global {
  // eslint-disable-next-line no-var
  var __db_pool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __db_test_pool: Pool | undefined;
}

const sslConfig = process.env.NODE_ENV === "production" ? { ssl: true } : {};

export const pool =
  globalThis.__db_pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...sslConfig,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__db_pool = pool;
}

export const testPool =
  globalThis.__db_test_pool ??
  new Pool({
    connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...sslConfig,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__db_test_pool = testPool;
}

/** Live (production) database — also the default for scripts and tests. */
export const db = drizzle(pool, { schema });

/** Test database — used when an admin has toggled test mode. */
export const testDb = drizzle(testPool, { schema });

/** Portable DB type — import this instead of driver-specific types. */
export type Db = typeof db;

/**
 * Returns the appropriate database for the current request.
 * Admins can switch to the test database via the `db_mode=test` cookie.
 * Falls back to the live database in non-request contexts (scripts, tests).
 *
 * The `db_mode` cookie can only be set via the admin-protected
 * `/api/admin/db-mode` endpoint, but we double-check admin status here
 * to guard against any cookie tampering.
 */
export async function getDb(): Promise<Db> {
  try {
    // next/headers is only available inside a Next.js request context.
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    if (cookieStore.get("db_mode")?.value === "test") {
      // Verify admin status before allowing test DB access.
      const { getCurrentUser } = await import("@/lib/auth");
      const user = await getCurrentUser();
      if (user?.isAdmin) {
        return testDb;
      }
    }
  } catch {
    // Outside a request context (e.g. seed scripts, unit tests) — use live db.
  }
  return db;
}


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
}

export const pool =
  globalThis.__db_pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ...(process.env.NODE_ENV === "production" && { ssl: true }),
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__db_pool = pool;
}

export const db = drizzle(pool, { schema });

/** Portable DB type — import this instead of driver-specific types. */
export type Db = typeof db;

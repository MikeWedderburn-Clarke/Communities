import { eq, and, like, or } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import type { Location, CreateLocationInput } from "@/types";

type Db = BetterSQLite3Database<typeof schema>;

export async function getLocationById(db: Db, id: string): Promise<Location | null> {
  const [row] = await db
    .select()
    .from(schema.locations)
    .where(eq(schema.locations.id, id))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export async function searchLocations(db: Db, query: string): Promise<Location[]> {
  const pattern = `%${query}%`;
  const rows = await db
    .select()
    .from(schema.locations)
    .where(
      or(
        like(schema.locations.name, pattern),
        like(schema.locations.city, pattern),
        like(schema.locations.country, pattern),
      ),
    )
    .limit(20);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
  }));
}

export async function getAllLocations(db: Db): Promise<Location[]> {
  const rows = await db
    .select()
    .from(schema.locations)
    .orderBy(schema.locations.country, schema.locations.city, schema.locations.name);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
  }));
}

export async function createLocation(
  db: Db,
  input: CreateLocationInput,
  createdBy: string,
): Promise<string> {
  const id = `loc-${crypto.randomUUID()}`;
  await db.insert(schema.locations).values({
    id,
    name: input.name,
    city: input.city,
    country: input.country,
    latitude: input.latitude,
    longitude: input.longitude,
    createdBy,
  });
  return id;
}

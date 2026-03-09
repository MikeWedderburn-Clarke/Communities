import { eq, and, like, or } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import type { Location, LocationRow, CreateLocationInput } from "@/types";

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
    what3names: row.what3names ?? null,
    howToFind: row.howToFind ?? null,
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
    what3names: row.what3names ?? null,
    howToFind: row.howToFind ?? null,
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
    what3names: row.what3names ?? null,
    howToFind: row.howToFind ?? null,
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
    what3names: input.what3names,
    howToFind: input.howToFind,
    createdBy,
  });
  return id;
}

/** Return all locations with createdBy user name for table views. */
export async function getAllLocationsWithCreatedBy(db: Db): Promise<LocationRow[]> {
  const rows = await db
    .select({
      id: schema.locations.id,
      name: schema.locations.name,
      city: schema.locations.city,
      country: schema.locations.country,
      latitude: schema.locations.latitude,
      longitude: schema.locations.longitude,
      what3names: schema.locations.what3names,
      howToFind: schema.locations.howToFind,
      createdBy: schema.locations.createdBy,
      createdByName: schema.users.name,
    })
    .from(schema.locations)
    .leftJoin(schema.users, eq(schema.locations.createdBy, schema.users.id))
    .orderBy(schema.locations.country, schema.locations.city, schema.locations.name);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    what3names: row.what3names ?? null,
    howToFind: row.howToFind ?? null,
    createdBy: row.createdBy ?? null,
    createdByName: row.createdByName ?? null,
  }));
}

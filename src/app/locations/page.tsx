import { Suspense } from "react";
import { LocationsContent } from "./locations-content";
import { getAllLocationsWithCreatedBy } from "@/services/locations";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const locations = await getAllLocationsWithCreatedBy(db);

  return (
    <main className="mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold">Locations</h1>
      <p className="mt-1 text-gray-600">
        All venues and event locations
      </p>
      <Suspense fallback={<p className="mt-8 text-gray-400">Loading…</p>}>
        <LocationsContent locations={locations} />
      </Suspense>
    </main>
  );
}

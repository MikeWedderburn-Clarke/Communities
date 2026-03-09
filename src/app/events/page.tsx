import { Suspense } from "react";
import Link from "next/link";
import { EventsContent } from "./events-content";
import { getAllEvents, getUserRsvpMap, getUserInterestSet, getInterestCounts, getAllEventsRaw } from "@/services/events";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import type { Role } from "@/types";
import { EventsTable } from "./events-table";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ city?: string; view?: string }>;
}

export default async function EventsPage({ searchParams }: Props) {
  const db = await getDb();
  const { city, view } = await searchParams;
  const user = await getCurrentUser();

  const isTableView = view === "table";

  // Table view: fetch raw rows only
  if (isTableView) {
    const rawRows = await getAllEventsRaw(db);
    return (
      <main className="mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Events</h1>
            <p className="mt-1 text-gray-600">AcroYoga jams, workshops, and meetups</p>
          </div>
          {user && (
            <Link
              href="/events/create"
              className="shrink-0 rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Create
            </Link>
          )}
        </div>
        <ViewToggle view="table" />
        <Suspense fallback={<p className="mt-8 text-gray-400">Loading…</p>}>
          <EventsTable events={rawRows} />
        </Suspense>
      </main>
    );
  }

  // Map view (default)
  const rawEvents = await getAllEvents(db);
  const eventIds = rawEvents.map((e) => e.id);
  const [rsvpMap, interestSet, interestCounts] = await Promise.all([
    user ? getUserRsvpMap(db, user.id) : ({} as Record<string, { role: Role; paymentStatus: string | null }>),
    user ? getUserInterestSet(db, user.id) : new Set<string>(),
    getInterestCounts(db, eventIds),
  ]);
  const events = rawEvents.map((e) => ({
    ...e,
    userRsvp: rsvpMap[e.id] ?? null,
    interestedCount: interestCounts[e.id] ?? 0,
    isInterested: interestSet.has(e.id),
  }));

  const homeCity = city ?? user?.homeCity ?? null;
  const lastLogin = user?.freshSince ?? null;

  return (
    <main className="mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="mt-1 text-gray-600">AcroYoga jams, workshops, and meetups</p>
        </div>
        {user && (
          <Link
            href="/events/create"
            className="shrink-0 rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Create
          </Link>
        )}
      </div>
      <ViewToggle view="map" />
      <Suspense fallback={<p className="mt-8 text-gray-400">Loading...</p>}>
        <EventsContent
          events={events}
          homeCity={homeCity}
          lastLogin={lastLogin}
          userId={user?.id ?? null}
        />
      </Suspense>
    </main>
  );
}

function ViewToggle({ view }: { view: "map" | "table" }) {
  return (
    <div className="mt-4 flex items-center gap-1 rounded-full border border-gray-300 bg-white p-0.5 w-fit text-sm font-medium shadow-sm">
      <Link
        href="/events?view=map"
        className={`rounded-full px-3 py-1 transition ${
          view === "map"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        Map
      </Link>
      <Link
        href="/events?view=table"
        className={`rounded-full px-3 py-1 transition ${
          view === "table"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        Table
      </Link>
    </div>
  );
}


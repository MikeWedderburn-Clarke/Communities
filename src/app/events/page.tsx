import { Suspense } from "react";
import { EventsContent } from "./events-content";
import { getAllEvents, getUserRsvpMap, getUserInterestSet, getInterestCounts } from "@/services/events";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import type { Role } from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ city?: string }>;
}

export default async function EventsPage({ searchParams }: Props) {
  const { city } = await searchParams;
  const user = await getCurrentUser();
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
      <h1 className="text-3xl font-bold">Events</h1>
      <p className="mt-1 text-gray-600">
        AcroYoga jams, workshops, and meetups
      </p>

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

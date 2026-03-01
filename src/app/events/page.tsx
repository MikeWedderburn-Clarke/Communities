import { Suspense } from "react";
import { EventsContent } from "./events-content";
import { getAllEvents, getUserRsvpMap } from "@/services/events";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ view?: string; city?: string }>;
}

export default async function EventsPage({ searchParams }: Props) {
  const { view, city } = await searchParams;
  const user = await getCurrentUser();
  const rawEvents = await getAllEvents(db);
  const rsvpMap = user ? await getUserRsvpMap(db, user.id) : {};
  const events = rawEvents.map((e) => ({ ...e, userRsvp: rsvpMap[e.id] ?? null }));

  const initialView = view === "map" ? "map" : "list";
  const homeCity = city ?? user?.homeCity ?? null;
  const lastLogin = user?.lastLogin ?? null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">Events</h1>
      <p className="mt-1 text-gray-600">
        AcroYoga jams, workshops, and meetups
      </p>

      <Suspense fallback={<p className="mt-8 text-gray-400">Loading...</p>}>
        <EventsContent
          events={events}
          initialView={initialView}
          homeCity={homeCity}
          lastLogin={lastLogin}
          userId={user?.id ?? null}
        />
      </Suspense>
    </main>
  );
}

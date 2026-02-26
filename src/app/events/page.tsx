import { Suspense } from "react";
import { Header } from "@/components/header";
import { EventsContent } from "./events-content";
import { getAllEvents } from "@/services/events";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ view?: string; city?: string }>;
}

export default async function EventsPage({ searchParams }: Props) {
  const { view, city } = await searchParams;
  const events = await getAllEvents(db);
  const user = await getCurrentUser();
  const initialView = view === "map" ? "map" : "list";
  // Use city from query param, fall back to user's home city
  const defaultCity = city ?? user?.homeCity ?? null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold">Upcoming Events</h1>
        <p className="mt-1 text-gray-600">
          AcroYoga jams, workshops, and meetups
        </p>

        <Suspense fallback={<p className="mt-8 text-gray-400">Loading...</p>}>
          <EventsContent
            events={events}
            initialView={initialView}
            defaultCity={defaultCity}
          />
        </Suspense>
      </main>
    </>
  );
}

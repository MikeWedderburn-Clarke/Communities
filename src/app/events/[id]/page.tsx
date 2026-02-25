import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { RoleBadges } from "@/components/role-badges";
import { getEventDetail } from "@/services/events";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { RsvpForm } from "./rsvp-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const event = await getEventDetail(db, id, user?.id ?? null, user?.isAdmin ?? false);

  if (!event) notFound();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/events"
          className="text-sm text-indigo-600 hover:underline"
        >
          &larr; All events
        </Link>

        <h1 className="mt-4 text-3xl font-bold">{event.title}</h1>

        <div className="mt-4 space-y-2 text-gray-600">
          <p>{formatDateTime(event.dateTime, event.endDateTime)}</p>
          <p>{event.location}</p>
        </div>

        <p className="mt-6 leading-relaxed text-gray-700">
          {event.description}
        </p>

        {/* Attendance summary — always visible */}
        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">
            Attendance ({event.attendeeCount} going)
          </h2>
          <div className="mt-2">
            <RoleBadges roleCounts={event.roleCounts} />
          </div>

          {/* Names only shown to logged-in users */}
          {user && event.visibleAttendees.length > 0 && (
            <ul className="mt-3 space-y-1">
              {event.visibleAttendees.map((a, i) => (
                <li key={i} className="text-sm text-gray-600">
                  {a.name}{" "}
                  <span className="text-xs text-gray-400">({a.role})</span>
                  {a.hidden && (
                    <span className="ml-1.5 inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      hidden
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!user && (
            <p className="mt-3 text-sm text-gray-500">
              <Link href={`/login?redirect=/events/${event.id}`} className="text-indigo-600 hover:underline">
                Log in
              </Link>{" "}
              to see who&apos;s going.
            </p>
          )}
        </section>

        {/* RSVP section */}
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          {user ? (
            <>
              <h2 className="font-semibold">
                {event.currentUserRsvp ? "Update your RSVP" : "RSVP"}
              </h2>
              <RsvpForm
                eventId={event.id}
                currentRsvp={event.currentUserRsvp}
              />
            </>
          ) : (
            <div>
              <h2 className="font-semibold">Want to join?</h2>
              <p className="mt-1 text-sm text-gray-600">
                <Link
                  href={`/login?redirect=/events/${event.id}`}
                  className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 inline-block mt-2"
                >
                  Log in to RSVP
                </Link>
              </p>
            </div>
          )}
        </section>

        {/* Calendar download */}
        <div className="mt-4">
          <a
            href={`/events/${event.id}/calendar.ics`}
            className="text-sm text-indigo-600 hover:underline"
          >
            Add to calendar (.ics)
          </a>
        </div>
      </main>
    </>
  );
}

function formatDateTime(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const startTime = s.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
  const endTime = e.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
  return `${dateStr}, ${startTime} – ${endTime}`;
}

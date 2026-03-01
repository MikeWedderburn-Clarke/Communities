import { notFound } from "next/navigation";
import { RoleBadges } from "@/components/role-badges";
import { SocialIcons } from "@/components/social-icons";
import { getEventDetail } from "@/services/events";
import { getCurrentUser } from "@/lib/auth";
import { buildExternalMapLinks } from "@/lib/map-links";
import { isEventFresh } from "@/lib/event-utils";
import { formatRecurrenceSummary } from "@/lib/recurrence";
import { formatCost } from "@/lib/format-cost";
import { db } from "@/db";
import { RsvpForm } from "./rsvp-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const user = await getCurrentUser();
  const event = await getEventDetail(db, id, user?.id ?? null, user?.isAdmin ?? false);

  if (!event) notFound();

  const mapLinks = buildExternalMapLinks({
    latitude: event.location.latitude,
    longitude: event.location.longitude,
    what3names: event.location.what3names,
  });
  const freshSinceLogin = isEventFresh(event, user?.lastLogin ?? null);
  const upcoming = event.nextOccurrence ?? { dateTime: event.dateTime, endDateTime: event.endDateTime };
  const recurrenceSummary = formatRecurrenceSummary(event.recurrence);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/events" className="text-indigo-600 hover:underline">Events</Link>
        {from === "map" || from === "list" ? (
          <>
            <span className="text-gray-400">›</span>
            <Link
              href={from === "map" ? "/events?view=map" : "/events"}
              className="text-indigo-600 hover:underline"
            >
              {from === "map" ? "Map" : "List"}
            </Link>
            <span className="text-gray-400">›</span>
            <span className="text-gray-700">{event.title}</span>
          </>
        ) : (
          <>
            <span className="text-gray-400">›</span>
            <span className="text-gray-700">{event.title}</span>
          </>
        )}
      </nav>

        <h1 className="mt-4 text-3xl font-bold">{event.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {freshSinceLogin && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              New since your last login
            </span>
          )}
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            event.skillLevel === "Beginner" ? "bg-green-100 text-green-700" :
            event.skillLevel === "Intermediate" ? "bg-yellow-100 text-yellow-700" :
            event.skillLevel === "Advanced" ? "bg-rose-100 text-rose-700" :
            "bg-indigo-100 text-indigo-700"
          }`}>
            {event.skillLevel}
          </span>
          <p className="text-xs text-gray-500">
            Added {formatCompactDate(event.dateAdded)}
            {event.dateAdded !== event.lastUpdated && (
              <>
                <span className="mx-1">•</span>
                Updated {formatCompactDate(event.lastUpdated)}
              </>
            )}
          </p>
        </div>

        <div className="mt-4 space-y-2 text-gray-600">
          <p>{formatDateTime(upcoming.dateTime, upcoming.endDateTime)}</p>
          {recurrenceSummary && (
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{recurrenceSummary}</p>
          )}
          <p>{event.location.name}, {event.location.city}, {event.location.country}</p>
          {event.location.what3names && (
            <p className="text-sm text-indigo-600">What3Names: {event.location.what3names}</p>
          )}
          {event.location.howToFind && (
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-600">How to find us:</span> {event.location.howToFind}
            </p>
          )}
          {mapLinks.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {mapLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-gray-200 px-3 py-1 text-gray-600 hover:bg-gray-50"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        <p className="mt-6 leading-relaxed text-gray-700">
          {event.description}
        </p>

        {/* Prerequisites */}
        {event.prerequisites && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-800">Prerequisites</h2>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {event.prerequisites.split("\n").filter(Boolean).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Attendance summary — always visible */}
        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">
            Attendance ({event.attendeeCount} going)
          </h2>
          <div className="mt-2">
            <RoleBadges roleCounts={event.roleCounts} teacherCount={event.teacherCount} />
          </div>

          {/* Names only shown to logged-in users */}
          {user && event.visibleAttendees.length > 0 && (
            <ul className="mt-3 space-y-1">
              {event.visibleAttendees.map((a, i) => (
                <li key={i} className="flex items-center gap-1 text-sm text-gray-600">
                  <Link href={`/profile/${a.userId}`} className="hover:text-indigo-600 hover:underline">
                    {a.name}
                  </Link>
                  <SocialIcons {...a.socialLinks} />{" "}
                  <span className="text-xs text-gray-400">({a.role})</span>
                  {a.isTeaching && (
                    <span className="ml-1.5 inline-flex items-center rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-800">
                      Teacher
                    </span>
                  )}
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
          {/* Cost — always visible */}
          {event.costAmount !== null && (
            <p className="mb-4 text-sm font-medium text-gray-700">
              Cost:{" "}
              <span className="text-gray-900">{formatCost(event.costAmount, event.costCurrency)}</span>
              {event.concessionAmount !== null && (
                <span className="ml-2 text-gray-500">
                  ({formatCost(event.concessionAmount, event.costCurrency)} concession)
                </span>
              )}
            </p>
          )}
          {user ? (
            <>
              <h2 className="font-semibold">
                {event.currentUserRsvp ? "Update your RSVP" : "RSVP"}
              </h2>
              <RsvpForm
                eventId={event.id}
                currentRsvp={event.currentUserRsvp}
                isTeacherApproved={user?.isTeacherApproved ?? false}
                defaultRole={user?.defaultRole ?? null}
                defaultShowName={user?.defaultShowName ?? null}
                prerequisites={event.prerequisites}
                costAmount={event.costAmount}
                costCurrency={event.costCurrency}
                concessionAmount={event.concessionAmount}
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

function formatCompactDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

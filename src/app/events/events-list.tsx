import Link from "next/link";
import { RoleBadges } from "@/components/role-badges";
import type { EventSummary } from "@/types";

interface Props {
  events: EventSummary[];
}

export function EventsList({ events }: Props) {
  if (events.length === 0) {
    return <p className="mt-8 text-gray-500">No events yet. Check back soon!</p>;
  }

  return (
    <ul className="mt-6 space-y-4">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/events/${event.id}`}
            className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{event.title}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {formatDateTime(event.dateTime)}
                </p>
                <p className="text-sm text-gray-500">{event.location.name}, {event.location.city}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-sm font-medium text-indigo-600">
                  {event.attendeeCount} going
                </span>
              </div>
            </div>
            <div className="mt-3">
              <RoleBadges roleCounts={event.roleCounts} teacherCount={event.teacherCount} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

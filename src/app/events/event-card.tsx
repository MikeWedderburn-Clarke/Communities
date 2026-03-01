"use client";

import Link from "next/link";
import { RoleBadges } from "@/components/role-badges";
import { formatRecurrenceSummary } from "@/lib/recurrence";
import type { EventSummary } from "@/types";

interface Props {
  event: EventSummary;
  highlight?: boolean;
  from?: "list" | "map";
}

export function EventCard({ event, highlight = false, from = "list" }: Props) {
  const barClasses = highlight
    ? "border-2 border-red-400 bg-red-50/60"
    : "border border-gray-200 bg-white";
  const updatedText = event.dateAdded !== event.lastUpdated;
  const upcoming = event.nextOccurrence ?? { dateTime: event.dateTime, endDateTime: event.endDateTime };
  const recurrenceSummary = formatRecurrenceSummary(event.recurrence);
  return (
    <li>
      <Link
        href={`/events/${event.id}?from=${from}`}
        className={`block rounded-lg px-5 py-4 shadow-sm transition hover:shadow-md ${barClasses}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
            <p className="mt-1 text-sm text-gray-600">Next: {formatDateTime(upcoming.dateTime)}</p>
            <p className="text-sm text-gray-500">{event.location.name}, {event.location.city}</p>
            {recurrenceSummary && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">{recurrenceSummary}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            {highlight && (
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                Updated
              </span>
            )}
            <p className="text-sm font-medium text-indigo-600">{event.attendeeCount} going</p>
          </div>
        </div>
        <div className="mt-3">
          <RoleBadges roleCounts={event.roleCounts} teacherCount={event.teacherCount} />
        </div>
        <div className="mt-3 text-xs text-gray-400">
          <span>Added {formatCompactDate(event.dateAdded)}</span>
          {updatedText && (
            <><span className="mx-1">•</span><span>Updated {formatCompactDate(event.lastUpdated)}</span></>
          )}
        </div>
      </Link>
    </li>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
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

"use client";

import Link from "next/link";
import { RoleBadges } from "@/components/role-badges";
import { formatRecurrenceSummary } from "@/lib/recurrence";
import { isEventFresh } from "@/lib/event-utils";
import type { EventSummary } from "@/types";

interface Props {
  event: EventSummary;
  lastLogin: string | null;
  from?: "list" | "map";
}

type CardStatus = "past" | "full" | "new" | "toPay" | "booked" | "default";

function getCardStatus(event: EventSummary, lastLogin: string | null): CardStatus {
  if (event.isPast) return "past";
  if (event.isFull) return "full";
  if (isEventFresh(event, lastLogin)) return "new";
  if (event.userRsvp && (event.costAmount ?? 0) > 0 && !event.userRsvp.paymentStatus) return "toPay";
  if (event.userRsvp) return "booked";
  return "default";
}

const STATUS_STYLES: Record<CardStatus, string> = {
  past:    "border-2 border-orange-400 bg-orange-50/60",
  full:    "border-2 border-red-400 bg-red-50/60",
  new:     "border-2 border-blue-400 bg-blue-50/60",
  toPay:   "border-2 border-yellow-400 bg-yellow-50/60",
  booked:  "border-2 border-green-400 bg-green-50/60",
  default: "border border-gray-200 bg-white",
};

const STATUS_LABELS: Record<CardStatus, { text: string; cls: string } | null> = {
  past:    { text: "Past",    cls: "text-orange-600" },
  full:    { text: "Full",    cls: "text-red-600" },
  new:     { text: "New",     cls: "text-blue-600" },
  toPay:   { text: "To Pay",  cls: "text-yellow-700" },
  booked:  { text: "Booked",  cls: "text-green-700" },
  default: null,
};

export function EventCard({ event, lastLogin, from = "list" }: Props) {
  const status = getCardStatus(event, lastLogin);
  const label = STATUS_LABELS[status];
  const upcoming = event.nextOccurrence ?? { dateTime: event.dateTime, endDateTime: event.endDateTime };
  const recurrenceSummary = formatRecurrenceSummary(event.recurrence);

  return (
    <li>
      <Link
        href={`/events/${event.id}?from=${from}`}
        className={`block rounded-lg px-5 py-4 shadow-sm transition hover:shadow-md ${STATUS_STYLES[status]}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
            <p className="mt-1 text-sm text-gray-600">
              {event.isPast ? "Last:" : "Next:"} {formatDateTime(upcoming.dateTime)}
            </p>
            <p className="text-sm text-gray-500">{event.location.name}, {event.location.city}</p>
            {recurrenceSummary && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">{recurrenceSummary}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            {label && (
              <span className={`text-xs font-semibold uppercase tracking-wider ${label.cls}`}>
                {label.text}
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
          {event.dateAdded !== event.lastUpdated && (
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

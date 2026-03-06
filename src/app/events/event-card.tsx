"use client";

import Link from "next/link";
import { RoleBadges } from "@/components/role-badges";
import { formatRecurrenceSummary } from "@/lib/recurrence";
import { isEventNew, isEventUpdated } from "@/lib/event-utils";
import { getEventDay, DAY_CARD_CLS } from "@/lib/day-utils";
import type { EventSummary } from "@/types";

interface Props {
  event: EventSummary;
  lastLogin: string | null;
  from?: "list" | "map";
}

type CardStatus = "past" | "full" | "new" | "updated" | "toPay" | "booked" | "default";

function getCardStatus(event: EventSummary, lastLogin: string | null): CardStatus {
  if (event.isPast) return "past";
  if (event.isFull) return "full";
  if (isEventNew(event, lastLogin)) return "new";
  if (isEventUpdated(event, lastLogin)) return "updated";
  if (event.userRsvp && (event.costAmount ?? 0) > 0 && !event.userRsvp.paymentStatus) return "toPay";
  if (event.userRsvp) return "booked";
  return "default";
}

const STATUS_LABELS: Record<CardStatus, string | null> = {
  past:    "Past",
  full:    "Full",
  new:     "New",
  updated: "Updated",
  toPay:   "To Pay",
  booked:  "Booked",
  default: null,
};

export function EventCard({ event, lastLogin, from = "list" }: Props) {
  const status = getCardStatus(event, lastLogin);
  const labelText = STATUS_LABELS[status];
  const upcoming = event.nextOccurrence ?? { dateTime: event.dateTime, endDateTime: event.endDateTime };
  const recurrenceSummary = formatRecurrenceSummary(event.recurrence);
  const day = getEventDay(event);
  const dayCls = DAY_CARD_CLS[day];

  return (
    <li>
      <Link
        href={`/events/${event.id}?from=${from}`}
        className={`block rounded-lg px-5 py-4 shadow-sm transition hover:shadow-md border-2 ${dayCls}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-600">
                {event.eventCategory}
              </span>
              {event.isExternal && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  External
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {event.isPast ? "Last:" : "Next:"} {formatDateTime(upcoming.dateTime)}
            </p>
            <p className="text-sm text-gray-500">{event.location.name}, {event.location.city}</p>
            {recurrenceSummary && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">{recurrenceSummary}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            {labelText && (
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {labelText}
              </span>
            )}
            <p className="text-sm font-medium text-indigo-600">{event.attendeeCount} going</p>
            {event.interestedCount > 0 && (
              <p className="text-xs text-pink-600">{event.interestedCount} interested</p>
            )}
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

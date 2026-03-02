"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { normalizeCityName } from "@/lib/city-utils";
import { DAY_HEX, getEventDay } from "@/lib/day-utils";
import { buildLocationHierarchy } from "@/lib/location-hierarchy";
import { isEventNew, isEventUpdated } from "@/lib/event-utils";
import { RoleBadges } from "@/components/role-badges";
import type { EventSummary } from "@/types";
import type { DrillState } from "./events-content";

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        Loading map…
      </div>
    ),
  },
);

interface Props {
  events: EventSummary[];
  allEvents: EventSummary[];
  lastLogin: string | null;
  homeCity: string | null;
}

function computeInitialExpansion(
  events: EventSummary[],
  homeCity: string | null,
): { country: string | null; city: string | null } {
  if (!homeCity) return { country: null, city: null };
  const normalized = normalizeCityName(homeCity) ?? homeCity;
  const hierarchy = buildLocationHierarchy(events);
  for (const c of hierarchy) {
    const city = c.cities.find((ci) => ci.city === normalized);
    if (city) return { country: c.country, city: city.city };
  }
  return { country: null, city: null };
}

// Chevron icon (points right; rotates 90° when expanded)
function Chevron({ expanded, size = "md" }: { expanded: boolean; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <svg
      className={`${dim} flex-shrink-0 text-gray-400 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="flex-shrink-0 min-w-[1.5rem] text-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 tabular-nums">
      {n}
    </span>
  );
}

function StatusBadge({ cls, children }: { cls: string; children: ReactNode }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
  );
}

// ── Compact event row displayed inside an expanded city ───────────────

interface EventRowProps {
  event: EventSummary;
  lastLogin: string | null;
}

function EventRow({ event, lastLogin }: EventRowProps) {
  const day = getEventDay(event);
  const borderColor = DAY_HEX[day];
  const upcoming = event.nextOccurrence ?? { dateTime: event.dateTime };
  const dateStr = new Date(upcoming.dateTime).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });

  const eventIsNew = isEventNew(event, lastLogin);
  const eventIsUpdated = isEventUpdated(event, lastLogin);

  return (
    <div
      className="pl-10 pr-3 py-3 bg-white hover:bg-gray-50 transition-colors"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Title + status badges */}
      <div className="flex items-start gap-2">
        <Link
          href={`/events/${event.id}?from=combined`}
          className="flex-1 text-sm font-semibold text-gray-900 hover:text-indigo-700 leading-snug"
        >
          {event.title}
        </Link>
        <div className="flex flex-shrink-0 flex-wrap gap-1 justify-end pt-0.5">
          {event.isPast   && <StatusBadge cls="bg-orange-100 text-orange-700">Past</StatusBadge>}
          {eventIsNew     && <StatusBadge cls="bg-blue-100 text-blue-700">New</StatusBadge>}
          {eventIsUpdated && <StatusBadge cls="bg-teal-100 text-teal-700">Updated</StatusBadge>}
          {event.isFull   && <StatusBadge cls="bg-red-100 text-red-700">Full</StatusBadge>}
          {event.userRsvp && !event.isPast && (
            <StatusBadge cls="bg-green-100 text-green-700">Booked</StatusBadge>
          )}
        </div>
      </div>

      {/* Date + venue */}
      <p className="mt-0.5 text-xs text-gray-500">
        {event.isPast ? "Last: " : ""}{dateStr} · {event.location.name}
      </p>

      {/* Role badges + skill level + cost */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <RoleBadges roleCounts={event.roleCounts} teacherCount={event.teacherCount} />
        {event.skillLevel && event.skillLevel !== "All levels" && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {event.skillLevel}
          </span>
        )}
        {event.costAmount !== null && event.costAmount > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {event.costAmount} {event.costCurrency ?? ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main combined view ────────────────────────────────────────────────

export function EventsCombined({ events, allEvents, lastLogin, homeCity }: Props) {
  const hierarchy = useMemo(() => buildLocationHierarchy(events), [events]);

  // Compute initial expansion from homeCity (only on first render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => computeInitialExpansion(events, homeCity), []);

  const [expandedCountry, setExpandedCountry] = useState<string | null>(initial.country);
  const [expandedCity, setExpandedCity] = useState<string | null>(initial.city);

  // Derive DrillState from tree expansion for the map
  const drill: DrillState = useMemo(() => {
    if (expandedCity && expandedCountry) {
      return { level: "city", country: expandedCountry, city: expandedCity };
    }
    if (expandedCountry) {
      return { level: "country", country: expandedCountry };
    }
    return { level: "globe" };
  }, [expandedCountry, expandedCity]);

  // Two-way sync: map marker click updates tree expansion
  function onMapDrill(d: DrillState) {
    if (d.level === "globe") {
      setExpandedCountry(null);
      setExpandedCity(null);
    } else if (d.level === "country") {
      setExpandedCountry(d.country);
      setExpandedCity(null);
    } else if (d.level === "city") {
      setExpandedCountry(d.country);
      setExpandedCity(d.city);
    }
    // "venue" level is not used in combined view
  }

  function toggleCountry(country: string) {
    if (expandedCountry === country) {
      setExpandedCountry(null);
      setExpandedCity(null);
    } else {
      setExpandedCountry(country);
      setExpandedCity(null);
    }
  }

  function toggleCity(city: string) {
    setExpandedCity((prev) => (prev === city ? null : city));
  }

  return (
    <div className="mt-6 flex min-h-[500px] h-[calc(100vh-280px)] overflow-hidden rounded-lg border border-gray-200 shadow-sm">

      {/* ── Left: collapsible location tree ─────────────────────── */}
      <div className="w-80 flex-shrink-0 overflow-y-auto bg-white border-r border-gray-200">
        {hierarchy.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No events match the current filters.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {hierarchy.map((countryGroup) => {
              const isCountryOpen = expandedCountry === countryGroup.country;
              const countryFresh = countryGroup.cities.some((c) =>
                c.venues.some((v) =>
                  v.events.some((e) => isEventNew(e, lastLogin) || isEventUpdated(e, lastLogin)),
                ),
              );

              return (
                <div key={countryGroup.country}>

                  {/* Country row */}
                  <button
                    type="button"
                    onClick={() => toggleCountry(countryGroup.country)}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                      isCountryOpen
                        ? "bg-indigo-50 text-indigo-900"
                        : "hover:bg-gray-50 text-gray-800"
                    }`}
                  >
                    <Chevron expanded={isCountryOpen} />
                    <span className="flex-1 text-sm font-semibold truncate">
                      {countryGroup.country}
                    </span>
                    {countryFresh && !isCountryOpen && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                    )}
                    <CountBadge n={countryGroup.eventCount} />
                  </button>

                  {/* Cities */}
                  {isCountryOpen && (
                    <div className="border-t border-gray-100">
                      {countryGroup.cities.map((cityGroup) => {
                        const isCityOpen = expandedCity === cityGroup.city;
                        const cityEvents = cityGroup.venues.flatMap((v) => v.events);
                        const cityFresh = cityEvents.some(
                          (e) => isEventNew(e, lastLogin) || isEventUpdated(e, lastLogin),
                        );

                        return (
                          <div key={cityGroup.city}>

                            {/* City row */}
                            <button
                              type="button"
                              onClick={() => toggleCity(cityGroup.city)}
                              className={`flex w-full items-center gap-2 py-2 pl-7 pr-3 text-left transition-colors ${
                                isCityOpen
                                  ? "bg-cyan-50 text-cyan-900"
                                  : "hover:bg-gray-50 text-gray-700"
                              }`}
                            >
                              <Chevron expanded={isCityOpen} size="sm" />
                              <span className="flex-1 text-sm font-medium truncate">
                                {cityGroup.city}
                              </span>
                              {cityFresh && !isCityOpen && (
                                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                              )}
                              <CountBadge n={cityGroup.eventCount} />
                            </button>

                            {/* Events list (shown when city is expanded) */}
                            {isCityOpen && (
                              <div className="divide-y divide-gray-100 border-t border-gray-100">
                                {cityEvents.map((event) => (
                                  <EventRow
                                    key={event.id}
                                    event={event}
                                    lastLogin={lastLogin}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: Leaflet map ───────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <LeafletMap
          events={events}
          allEvents={allEvents}
          userLastLogin={lastLogin}
          drill={drill}
          onDrill={onMapDrill}
        />
      </div>
    </div>
  );
}

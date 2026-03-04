"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { DAY_HEX, getEventDay } from "@/lib/day-utils";
import { buildLocationHierarchy, getContinent } from "@/lib/location-hierarchy";
import { isEventNew, isEventUpdated } from "@/lib/event-utils";
import { toDateString } from "@/lib/date-utils";
import { RoleBadges } from "@/components/role-badges";
import { EventCalendar, type DateRange } from "./event-calendar";
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
  drill: DrillState;
  onDrill: (d: DrillState) => void;
  dateRange: DateRange | null;
  onDateRangeChange: (r: DateRange | null) => void;
}

// ── Shared tree UI primitives ─────────────────────────────────────────────────

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3 w-3 flex-shrink-0 text-gray-400 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
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
    <span aria-label={`${n} events`} className="flex-shrink-0 min-w-[1.5rem] text-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 tabular-nums">
      {n}
    </span>
  );
}

function FreshDot() {
  return <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />;
}

function StatusBadge({ cls, children }: { cls: string; children: ReactNode }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
  );
}

// ── Compact event row ─────────────────────────────────────────────────────────

interface EventRowProps {
  event: EventSummary;
  lastLogin: string | null;
  dateRange: DateRange | null;
}

function EventRow({ event, lastLogin, dateRange }: EventRowProps) {
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

  // If a date range is active, look up per-occurrence counts
  const occCounts = (() => {
    if (!dateRange || !event.occurrenceAttendance) return null;
    const startStr = toDateString(dateRange.start);
    const endStr   = toDateString(dateRange.end);
    const keys = Object.keys(event.occurrenceAttendance).filter((k) => k >= startStr && k <= endStr);
    if (keys.length === 0) return null;
    let attendeeCount = 0;
    const roleCounts = { Base: 0, Flyer: 0, Hybrid: 0 };
    let teacherCount = 0;
    for (const k of keys) {
      const o = event.occurrenceAttendance[k];
      attendeeCount += o.attendeeCount;
      roleCounts.Base += o.roleCounts.Base;
      roleCounts.Flyer += o.roleCounts.Flyer;
      roleCounts.Hybrid += o.roleCounts.Hybrid;
      teacherCount += o.teacherCount;
    }
    return { attendeeCount, roleCounts, teacherCount };
  })();

  const displayAttendeeCount = occCounts?.attendeeCount ?? event.attendeeCount;
  const displayRoleCounts = occCounts?.roleCounts ?? event.roleCounts;
  const displayTeacherCount = occCounts?.teacherCount ?? event.teacherCount;

  return (
    <div
      className="pl-14 pr-3 py-3 bg-white hover:bg-gray-50 transition-colors"
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

      {/* Role badges + skill level + cost + attendee count */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <RoleBadges roleCounts={displayRoleCounts} teacherCount={displayTeacherCount} />
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
        <span
          className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-white text-xs font-bold tabular-nums"
          style={{ background: borderColor, width: "2rem", height: "2rem", fontSize: "0.65rem" }}
          title={`${displayAttendeeCount}${event.maxAttendees != null ? `/${event.maxAttendees}` : ""} attendee${displayAttendeeCount !== 1 ? "s" : ""}${occCounts ? " (this occurrence)" : ""}`}
        >
          {displayAttendeeCount}{event.maxAttendees != null ? `/${event.maxAttendees}` : ""}
        </span>
      </div>
    </div>
  );
}

// ── Main combined view ────────────────────────────────────────────────────────

export function EventsCombined({ events, allEvents, lastLogin, drill, onDrill, dateRange, onDateRangeChange }: Props) {
  // Derive expansion state from drill prop
  const expandedContinent: string | null =
    drill.level === "continent" ? drill.continent
    : drill.level === "country" ? getContinent(drill.country)
    : drill.level === "city" ? getContinent(drill.country)
    : null;

  const expandedCountry: string | null =
    drill.level === "country" ? drill.country
    : drill.level === "city" ? drill.country
    : null;

  const expandedCity: string | null =
    drill.level === "city" ? drill.city : null;

  // events prop is already date+status filtered (from events-content)
  const hierarchy = useMemo(() => buildLocationHierarchy(events), [events]);

  function toggleContinent(continent: string) {
    if (expandedContinent === continent) {
      onDrill({ level: "globe" });
    } else {
      onDrill({ level: "continent", continent });
    }
  }

  function toggleCountry(country: string) {
    if (expandedCountry === country) {
      onDrill({ level: "continent", continent: getContinent(country) });
    } else {
      onDrill({ level: "country", country });
    }
  }

  function toggleCity(city: string) {
    if (expandedCity === city) {
      onDrill({ level: "country", country: expandedCountry! });
    } else {
      onDrill({ level: "city", country: expandedCountry!, city });
    }
  }

  // Shared row class for each depth level
  const rowBase = "flex w-full items-center gap-2 pr-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors";

  return (
    <div className="mt-6 flex min-h-[500px] h-[calc(100vh-280px)] overflow-hidden rounded-lg border border-gray-200 shadow-sm">

      {/* ── Left: collapsible location tree ─────────────────────── */}
      <div className="w-80 flex-shrink-0 overflow-y-auto bg-white border-r border-gray-200">
        {hierarchy.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No events match the current filters.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {hierarchy.map((continentGroup) => {
              const isContinentOpen = expandedContinent === continentGroup.continent;
              const continentFresh = continentGroup.countries.some((co) =>
                co.cities.some((ci) =>
                  ci.venues.some((v) =>
                    v.events.some((e) => isEventNew(e, lastLogin) || isEventUpdated(e, lastLogin)),
                  ),
                ),
              );

              return (
                <div key={continentGroup.continent}>

                  {/* Continent row — depth 0, pl-2 */}
                  <button
                    type="button"
                    onClick={() => toggleContinent(continentGroup.continent)}
                    aria-expanded={isContinentOpen}
                    aria-controls={`continent-panel-${continentGroup.continent.replace(/\s/g, "-")}`}
                    className={`${rowBase} pl-2 ${isContinentOpen ? "bg-violet-50 text-violet-900" : "hover:bg-gray-50"}`}
                  >
                    <Chevron expanded={isContinentOpen} />
                    <span className="flex-1 truncate">{continentGroup.continent}</span>
                    {continentFresh && !isContinentOpen && <FreshDot />}
                    <CountBadge n={continentGroup.eventCount} />
                  </button>

                  {/* Countries */}
                  {isContinentOpen && (
                    <div id={`continent-panel-${continentGroup.continent.replace(/\s/g, "-")}`} role="region" className="border-t border-gray-100">
                      {continentGroup.countries.map((countryGroup) => {
                        const isCountryOpen = expandedCountry === countryGroup.country;
                        const countryFresh = countryGroup.cities.some((ci) =>
                          ci.venues.some((v) =>
                            v.events.some((e) => isEventNew(e, lastLogin) || isEventUpdated(e, lastLogin)),
                          ),
                        );

                        return (
                          <div key={countryGroup.country}>

                            {/* Country row — depth 1, pl-6 */}
                            <button
                              type="button"
                              onClick={() => toggleCountry(countryGroup.country)}
                              aria-expanded={isCountryOpen}
                              aria-controls={`country-panel-${countryGroup.country.replace(/\s/g, "-")}`}
                              className={`${rowBase} pl-6 ${isCountryOpen ? "bg-indigo-50 text-indigo-900" : "hover:bg-gray-50"}`}
                            >
                              <Chevron expanded={isCountryOpen} />
                              <span className="flex-1 truncate">{countryGroup.country}</span>
                              {countryFresh && !isCountryOpen && <FreshDot />}
                              <CountBadge n={countryGroup.eventCount} />
                            </button>

                            {/* Cities */}
                            {isCountryOpen && (
                              <div id={`country-panel-${countryGroup.country.replace(/\s/g, "-")}`} role="region" className="border-t border-gray-100">
                                {countryGroup.cities.map((cityGroup) => {
                                  const isCityOpen = expandedCity === cityGroup.city;
                                  const cityEvents = cityGroup.venues.flatMap((v) => v.events);
                                  const cityFresh = cityEvents.some(
                                    (e) => isEventNew(e, lastLogin) || isEventUpdated(e, lastLogin),
                                  );

                                  return (
                                    <div key={cityGroup.city}>

                                      {/* City row — depth 2, pl-10 */}
                                      <button
                                        type="button"
                                        onClick={() => toggleCity(cityGroup.city)}
                                        aria-expanded={isCityOpen}
                                        aria-controls={`city-panel-${cityGroup.city.replace(/\s/g, "-")}`}
                                        className={`${rowBase} pl-10 ${isCityOpen ? "bg-cyan-50 text-cyan-900" : "hover:bg-gray-50"}`}
                                      >
                                        <Chevron expanded={isCityOpen} />
                                        <span className="flex-1 truncate">{cityGroup.city}</span>
                                        {cityFresh && !isCityOpen && <FreshDot />}
                                        <CountBadge n={cityGroup.eventCount} />
                                      </button>

                                      {/* Events — depth 3 */}
                                      {isCityOpen && (
                                        <div id={`city-panel-${cityGroup.city.replace(/\s/g, "-")}`} className="divide-y divide-gray-100 border-t border-gray-100">
                                          {cityEvents.map((event) => (
                                            <EventRow
                                              key={event.id}
                                              event={event}
                                              lastLogin={lastLogin}
                                              dateRange={dateRange}
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
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: calendar + Leaflet map ───────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <EventCalendar
          events={events}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
        />
        <div className="flex-1 min-h-0">
          <LeafletMap
            events={events}
            allEvents={allEvents}
            userLastLogin={lastLogin}
            drill={drill}
            onDrill={onDrill}
            dateRange={dateRange}
            embedded
          />
        </div>
      </div>
    </div>
  );
}

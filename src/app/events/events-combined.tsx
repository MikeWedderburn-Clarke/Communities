"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { normalizeCityName } from "@/lib/city-utils";
import { DAY_HEX, getEventDay } from "@/lib/day-utils";
import { buildLocationHierarchy, getContinent } from "@/lib/location-hierarchy";
import { isEventNew, isEventUpdated } from "@/lib/event-utils";
import { RoleBadges } from "@/components/role-badges";
import { EventCalendar } from "./event-calendar";
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
): { continent: string | null; country: string | null; city: string | null } {
  if (!homeCity) return { continent: null, country: null, city: null };
  const normalized = normalizeCityName(homeCity) ?? homeCity;
  const hierarchy = buildLocationHierarchy(events);
  for (const continentGroup of hierarchy) {
    for (const co of continentGroup.countries) {
      const city = co.cities.find((ci) => ci.city === normalized);
      if (city) return { continent: continentGroup.continent, country: co.country, city: city.city };
    }
  }
  return { continent: null, country: null, city: null };
}

// ── Shared tree UI primitives ─────────────────────────────────────────────────

// All rows in the tree use the same Chevron component and the same text-sm font.
// Indentation: +pl-4 per depth level (l0=pl-2, l1=pl-6, l2=pl-10, events=pl-14).

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
    <span className="flex-shrink-0 min-w-[1.5rem] text-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 tabular-nums">
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

// ── Main combined view ────────────────────────────────────────────────────────

export function EventsCombined({ events, allEvents, lastLogin, homeCity }: Props) {
  // Compute initial expansion from homeCity (only on first render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => computeInitialExpansion(events, homeCity), []);

  const [expandedContinent, setExpandedContinent] = useState<string | null>(initial.continent);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(initial.country);
  const [expandedCity, setExpandedCity] = useState<string | null>(initial.city);

  // ── Date filter (driven by the EventCalendar above the map) ───────
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const displayEvents = selectedDate
    ? events.filter((e) => {
        const dt = new Date(e.nextOccurrence?.dateTime ?? e.dateTime);
        return (
          dt.getFullYear() === selectedDate.getFullYear() &&
          dt.getMonth() === selectedDate.getMonth() &&
          dt.getDate() === selectedDate.getDate()
        );
      })
    : events;

  const hierarchy = useMemo(() => buildLocationHierarchy(displayEvents), [displayEvents]);
  const drill: DrillState = useMemo(() => {
    if (expandedCity && expandedCountry) {
      return { level: "city", country: expandedCountry, city: expandedCity };
    }
    if (expandedCountry) {
      return { level: "country", country: expandedCountry };
    }
    if (expandedContinent) {
      return { level: "continent", continent: expandedContinent };
    }
    return { level: "globe" };
  }, [expandedContinent, expandedCountry, expandedCity]);

  // Two-way sync: map marker/zoom click updates tree expansion
  function onMapDrill(d: DrillState) {
    if (d.level === "globe") {
      setExpandedContinent(null);
      setExpandedCountry(null);
      setExpandedCity(null);
    } else if (d.level === "continent") {
      setExpandedContinent(d.continent);
      setExpandedCountry(null);
      setExpandedCity(null);
    } else if (d.level === "country") {
      setExpandedContinent(getContinent(d.country));
      setExpandedCountry(d.country);
      setExpandedCity(null);
    } else if (d.level === "city") {
      setExpandedContinent(getContinent(d.country));
      setExpandedCountry(d.country);
      setExpandedCity(d.city);
    }
  }

  function toggleContinent(continent: string) {
    if (expandedContinent === continent) {
      setExpandedContinent(null);
      setExpandedCountry(null);
      setExpandedCity(null);
    } else {
      setExpandedContinent(continent);
      setExpandedCountry(null);
      setExpandedCity(null);
    }
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

  // Shared row class for each depth level — same font, same text size, only indent changes
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
                    className={`${rowBase} pl-2 ${isContinentOpen ? "bg-violet-50 text-violet-900" : "hover:bg-gray-50"}`}
                  >
                    <Chevron expanded={isContinentOpen} />
                    <span className="flex-1 truncate">{continentGroup.continent}</span>
                    {continentFresh && !isContinentOpen && <FreshDot />}
                    <CountBadge n={continentGroup.eventCount} />
                  </button>

                  {/* Countries */}
                  {isContinentOpen && (
                    <div className="border-t border-gray-100">
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
                              className={`${rowBase} pl-6 ${isCountryOpen ? "bg-indigo-50 text-indigo-900" : "hover:bg-gray-50"}`}
                            >
                              <Chevron expanded={isCountryOpen} />
                              <span className="flex-1 truncate">{countryGroup.country}</span>
                              {countryFresh && !isCountryOpen && <FreshDot />}
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

                                      {/* City row — depth 2, pl-10 */}
                                      <button
                                        type="button"
                                        onClick={() => toggleCity(cityGroup.city)}
                                        className={`${rowBase} pl-10 ${isCityOpen ? "bg-cyan-50 text-cyan-900" : "hover:bg-gray-50"}`}
                                      >
                                        <Chevron expanded={isCityOpen} />
                                        <span className="flex-1 truncate">{cityGroup.city}</span>
                                        {cityFresh && !isCityOpen && <FreshDot />}
                                        <CountBadge n={cityGroup.eventCount} />
                                      </button>

                                      {/* Events — depth 3 */}
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
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: calendar + Leaflet map ───────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <EventCalendar
          events={events}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
        <div className="flex-1 min-h-0">
          <LeafletMap
            events={displayEvents}
            allEvents={allEvents}
            userLastLogin={lastLogin}
            drill={drill}
            onDrill={onMapDrill}
            embedded
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { EventSummary } from "@/types";
import { isEventNew, isEventUpdated, hasOccurrenceInRange, countOccurrencesInRange } from "@/lib/event-utils";
import { toDateString } from "@/lib/date-utils";
import { type DateRange } from "./event-calendar";
import { buildLocationHierarchy, getContinent } from "@/lib/location-hierarchy";
import { normalizeCityName } from "@/lib/city-utils";
import { EventsCombined } from "./events-combined";

export type DrillState =
  | { level: "globe" }
  | { level: "continent"; continent: string }
  | { level: "country"; country: string }
  | { level: "city"; country: string; city: string }
  | { level: "venue"; country: string; city: string; venue: string };

type FilterKey = "all" | "new" | "updated" | "full" | "past" | "booked" | "toPay";
export type CountMode = "events" | "instances";

interface Props {
  events: EventSummary[];
  homeCity: string | null;
  lastLogin: string | null;
  userId: string | null;
}

function computeInitialDrill(events: EventSummary[], homeCity: string | null): DrillState {
  if (!homeCity) return { level: "globe" };
  const normalized = normalizeCityName(homeCity) ?? homeCity;
  const hierarchy = buildLocationHierarchy(events);
  for (const continentGroup of hierarchy) {
    for (const country of continentGroup.countries) {
      const city = country.cities.find((c) => c.city === normalized);
      if (city) return { level: "city", country: country.country, city: city.city };
    }
  }
  return { level: "globe" };
}

function parseDateRange(from: string | null, to: string | null): DateRange | null {
  if (!from || !to) return null;
  const start = new Date(from);
  const end = new Date(to);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

export function EventsContent({ events, homeCity, lastLogin, userId }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ── Drill state derived from URL ───────────────────────────────────────────
  const locationDrill: DrillState = useMemo(() => {
    const city = searchParams.get("city");
    const country = searchParams.get("country");
    const continent = searchParams.get("continent");
    if (city && country) return { level: "city", country, city };
    if (country) return { level: "country", country };
    if (continent) return { level: "continent", continent };
    return computeInitialDrill(events, homeCity);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, homeCity]);

  // ── Date range derived from URL ────────────────────────────────────────────
  const dateRange: DateRange | null = useMemo(() => {
    return parseDateRange(searchParams.get("from"), searchParams.get("to"));
  }, [searchParams]);

  // ── Status filter derived from URL ─────────────────────────────────────────
  const activeFilter: FilterKey | null = useMemo(() => {
    const f = searchParams.get("filter") as FilterKey | null;
    const validKeys: FilterKey[] = ["all", "new", "updated", "full", "past", "booked", "toPay"];
    return f && validKeys.includes(f) ? f : null;
  }, [searchParams]);

  // ── Count mode derived from URL ────────────────────────────────────────────
  const countMode: CountMode = useMemo(() => {
    return searchParams.get("mode") === "instances" ? "instances" : "events";
  }, [searchParams]);

  // ── URL update helper ──────────────────────────────────────────────────────
  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleDrill(d: DrillState) {
    const updates: Record<string, string | null> = { continent: null, country: null, city: null };
    if (d.level === "continent") updates.continent = d.continent;
    else if (d.level === "country") updates.country = d.country;
    else if (d.level === "city") { updates.country = d.country; updates.city = d.city; }
    else if (d.level === "venue") { updates.country = d.country; updates.city = d.city; }
    updateParams(updates);
  }

  function handleDateRangeChange(r: DateRange | null) {
    updateParams({ from: r ? toDateString(r.start) : null, to: r ? toDateString(r.end) : null });
  }

  function selectFilter(f: FilterKey) {
    updateParams({ filter: activeFilter === f ? null : f });
  }

  // ── Location filter: restrict events to the drilled-into continent/country/city ──
  const locationFilteredEvents = useMemo(() => {
    if (locationDrill.level === "globe") return events;
    if (locationDrill.level === "continent") {
      return events.filter((e) => getContinent(e.location.country) === locationDrill.continent);
    }
    if (locationDrill.level === "country") {
      return events.filter((e) => e.location.country === locationDrill.country);
    }
    // city or venue
    const { country, city } = locationDrill as { country: string; city: string };
    return events.filter(
      (e) =>
        e.location.country === country &&
        (normalizeCityName(e.location.city) ?? e.location.city) === city,
    );
  }, [events, locationDrill]);

  // ── Pre-status base: location+date-range filtered ─────────────────────────
  const preStatusBase = useMemo(() => {
    if (!dateRange) return locationFilteredEvents;
    return locationFilteredEvents.filter((e) => hasOccurrenceInRange(e, dateRange.start, dateRange.end));
  }, [locationFilteredEvents, dateRange]);

  // ── Filter counts — single pass ────────────────────────────────────────────
  const filterCounts = useMemo(() => {
    const counts = { upcoming: 0, all: 0, new: 0, updated: 0, full: 0, past: 0, booked: 0, toPay: 0 };
    for (const e of preStatusBase) {
      const w = countMode === "instances" && dateRange
        ? countOccurrencesInRange(e, dateRange.start, dateRange.end)
        : 1;
      counts.all += w;
      if (e.isPast) {
        counts.past += w;
      } else {
        counts.upcoming += w;
        if (isEventNew(e, lastLogin))             counts.new += w;
        if (isEventUpdated(e, lastLogin))         counts.updated += w;
        if (e.isFull)                             counts.full += w;
        if (e.userRsvp !== null)                  counts.booked += w;
        if (e.userRsvp !== null && (e.costAmount ?? 0) > 0 && e.userRsvp.paymentStatus === null)
          counts.toPay += w;
      }
    }
    return counts;
  }, [preStatusBase, lastLogin, countMode, dateRange]);

  // ── Filtered events ────────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    switch (activeFilter) {
      case "all":     return preStatusBase;
      case "new":     return preStatusBase.filter((e) => !e.isPast && isEventNew(e, lastLogin));
      case "updated": return preStatusBase.filter((e) => !e.isPast && isEventUpdated(e, lastLogin));
      case "full":    return preStatusBase.filter((e) => e.isFull);
      case "past":    return preStatusBase.filter((e) => e.isPast);
      case "booked":  return preStatusBase.filter((e) => !e.isPast && e.userRsvp !== null);
      case "toPay":   return preStatusBase.filter((e) => !e.isPast && e.userRsvp !== null && (e.costAmount ?? 0) > 0 && e.userRsvp.paymentStatus === null);
      default:        return preStatusBase.filter((e) => !e.isPast);
    }
  }, [preStatusBase, activeFilter, lastLogin]);

  // Status-filtered but NOT date-filtered — used for calendar year/month counts
  // so the counts reflect the active status filter across all time periods.
  // Also location-filtered to match the current drill state.
  const statusFilteredEvents = useMemo(() => {
    switch (activeFilter) {
      case "all":     return locationFilteredEvents;
      case "new":     return locationFilteredEvents.filter((e) => !e.isPast && isEventNew(e, lastLogin));
      case "updated": return locationFilteredEvents.filter((e) => !e.isPast && isEventUpdated(e, lastLogin));
      case "full":    return locationFilteredEvents.filter((e) => e.isFull);
      case "past":    return locationFilteredEvents.filter((e) => e.isPast);
      case "booked":  return locationFilteredEvents.filter((e) => !e.isPast && e.userRsvp !== null);
      case "toPay":   return locationFilteredEvents.filter((e) => !e.isPast && e.userRsvp !== null && (e.costAmount ?? 0) > 0 && e.userRsvp.paymentStatus === null);
      default:        return locationFilteredEvents.filter((e) => !e.isPast);
    }
  }, [locationFilteredEvents, activeFilter, lastLogin]);

  type FilterDef = { key: FilterKey; label: string; selectedCls: string; loggedInOnly?: boolean };

  const filterDefs: FilterDef[] = [
    { key: "all",     label: "Show all", selectedCls: "bg-gray-800 text-white border-gray-800" },
    { key: "new",     label: "New",      selectedCls: "bg-blue-600 text-white border-blue-600" },
    { key: "updated", label: "Updated",  selectedCls: "bg-teal-600 text-white border-teal-600" },
    { key: "full",    label: "Full",     selectedCls: "bg-red-600 text-white border-red-600" },
    { key: "past",    label: "Past",     selectedCls: "bg-orange-500 text-white border-orange-500" },
    { key: "booked",  label: "Booked",   selectedCls: "bg-green-600 text-white border-green-600", loggedInOnly: true },
    { key: "toPay",   label: "To Pay",   selectedCls: "bg-yellow-500 text-white border-yellow-500", loggedInOnly: true },
  ];

  const unselectedCls = "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50";
  const upcomingSelected = activeFilter === null;

  return (
    <>
      {/* Show all / reset — clears all filters and returns to /events */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className={`rounded-full border px-3 py-1 text-sm font-medium transition shadow-sm ${
            !searchParams.toString()
              ? "bg-gray-700 text-white border-gray-700 shadow-inner cursor-default"
              : "border-gray-400 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Show all ({events.length})
        </button>

        {/* Count mode toggle */}
        <div className="flex items-center gap-1 rounded-full border border-gray-300 bg-white p-0.5 text-xs font-medium shadow-sm">
          <button
            type="button"
            onClick={() => updateParams({ mode: null })}
            className={`rounded-full px-2.5 py-1 transition ${
              countMode === "events"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Unique events
          </button>
          <button
            type="button"
            onClick={() => updateParams({ mode: "instances" })}
            className={`rounded-full px-2.5 py-1 transition ${
              countMode === "instances"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All instances
          </button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Upcoming */}
        <button
          type="button"
          onClick={() => updateParams({ filter: null })}
          className={`rounded-full border px-3 py-1 text-sm font-medium transition shadow-sm ${
            upcomingSelected ? "bg-indigo-600 text-white border-indigo-600 shadow-inner" : unselectedCls
          }`}
        >
          Upcoming ({filterCounts.upcoming})
        </button>

        {filterDefs
          .filter((f) => f.key !== "all" && (!f.loggedInOnly || userId !== null))
          .map((f) => {
            const active = activeFilter === f.key;
            const count = filterCounts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => selectFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition shadow-sm ${
                  active ? `${f.selectedCls} shadow-inner` : unselectedCls
                }`}
              >
                {f.label} ({count})
              </button>
            );
          })}
      </div>

      <EventsCombined
        events={filteredEvents}
        allEvents={statusFilteredEvents}
        lastLogin={lastLogin}
        drill={locationDrill}
        onDrill={handleDrill}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        countMode={countMode}
      />
    </>
  );
}

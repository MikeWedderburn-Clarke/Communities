"use client";

import { useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { EventSummary } from "@/types";
import { isEventNew, isEventUpdated, hasOccurrenceInRange } from "@/lib/event-utils";
import { type DateRange } from "./event-calendar";
import { buildLocationHierarchy } from "@/lib/location-hierarchy";
import { normalizeCityName } from "@/lib/city-utils";
import { EventsCombined } from "./events-combined";

export type DrillState =
  | { level: "globe" }
  | { level: "continent"; continent: string }
  | { level: "country"; country: string }
  | { level: "city"; country: string; city: string }
  | { level: "venue"; country: string; city: string; venue: string };

type FilterKey = "all" | "new" | "updated" | "full" | "past" | "booked" | "toPay";

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

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    updateParams({ from: r ? formatDate(r.start) : null, to: r ? formatDate(r.end) : null });
  }

  function selectFilter(f: FilterKey) {
    updateParams({ filter: activeFilter === f ? null : f });
  }

  // ── Pre-status base: date-range filtered ───────────────────────────────────
  const preStatusBase = useMemo(() => {
    if (!dateRange) return events;
    return events.filter((e) => hasOccurrenceInRange(e, dateRange.start, dateRange.end));
  }, [events, dateRange]);

  // ── Filter counts ──────────────────────────────────────────────────────────
  const filterCounts = useMemo(() => ({
    upcoming: preStatusBase.filter((e) => !e.isPast).length,
    all:      preStatusBase.length,
    new:      preStatusBase.filter((e) => !e.isPast && isEventNew(e, lastLogin)).length,
    updated:  preStatusBase.filter((e) => !e.isPast && isEventUpdated(e, lastLogin)).length,
    full:     preStatusBase.filter((e) => e.isFull).length,
    past:     preStatusBase.filter((e) => e.isPast).length,
    booked:   preStatusBase.filter((e) => !e.isPast && e.userRsvp !== null).length,
    toPay:    preStatusBase.filter((e) => !e.isPast && e.userRsvp !== null && (e.costAmount ?? 0) > 0 && e.userRsvp.paymentStatus === null).length,
  }), [preStatusBase, lastLogin]);

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
      <div className="mt-6 flex items-center">
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
        allEvents={events}
        lastLogin={lastLogin}
        drill={locationDrill}
        onDrill={handleDrill}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />
    </>
  );
}

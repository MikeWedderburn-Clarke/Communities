"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { EventSummary } from "@/types";
import { isEventNew, isEventUpdated } from "@/lib/event-utils";
import { getEventDay, DAY_ABBR, DAY_PILL_CLS, DAYS_MON_FIRST } from "@/lib/day-utils";
import { buildLocationHierarchy } from "@/lib/location-hierarchy";
import { normalizeCityName } from "@/lib/city-utils";
import { EventsHierarchy } from "./events-hierarchy";
import { EventsCombined } from "./events-combined";

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((m) => m.LeafletMap),
  { ssr: false, loading: () => <p className="mt-8 text-gray-400">Loading map...</p> },
);

type View = "list" | "map" | "combined";

export type DrillState =
  | { level: "globe" }
  | { level: "country"; country: string }
  | { level: "city"; country: string; city: string }
  | { level: "venue"; country: string; city: string; venue: string };

type FilterKey = "all" | "new" | "updated" | "full" | "past" | "booked" | "toPay";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  events: EventSummary[];
  initialView: View;
  homeCity: string | null;
  lastLogin: string | null;
  userId: string | null;
}

function computeInitialDrill(events: EventSummary[], homeCity: string | null): DrillState {
  if (!homeCity) return { level: "globe" };
  const normalized = normalizeCityName(homeCity) ?? homeCity;
  const hierarchy = buildLocationHierarchy(events);
  for (const country of hierarchy) {
    const city = country.cities.find((c) => c.city === normalized);
    if (city) return { level: "city", country: country.country, city: city.city };
  }
  return { level: "globe" };
}

export function EventsContent({ events, initialView, homeCity, lastLogin, userId }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view = (searchParams.get("view") as View) ?? initialView;

  // ── Shared location drill state ────────────────────────────────────
  const initialDrill = useMemo(() => computeInitialDrill(events, homeCity), [events, homeCity]);
  const [locationDrill, setLocationDrill] = useState<DrillState>(initialDrill);

  // ── Status filter state (radio) ────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);

  function selectFilter(f: FilterKey) {
    setActiveFilter((prev) => (prev === f ? null : f));
  }

  // ── Day-of-week filter state (single-select) ───────────────────────
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  function toggleDay(d: number) {
    setSelectedDay((prev) => (prev === d ? null : d));
  }

  // ── Year/month state ───────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // ── Derived years ──────────────────────────────────────────────────
  const years = useMemo(() => {
    const s = new Set<number>();
    for (const e of events) {
      const d = new Date(e.nextOccurrence?.dateTime ?? e.dateTime);
      s.add(d.getFullYear());
    }
    return Array.from(s).sort();
  }, [events]);

  // ── Derived months for selected year ──────────────────────────────
  const months = useMemo(() => {
    if (selectedYear === null) return [];
    const s = new Set<number>();
    for (const e of events) {
      const d = new Date(e.nextOccurrence?.dateTime ?? e.dateTime);
      if (d.getFullYear() === selectedYear) s.add(d.getMonth());
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [events, selectedYear]);

  // ── Pre-status base: year/month + day filters applied ─────────────
  const preStatusBase = useMemo(() => {
    let base = events;
    if (selectedYear !== null) {
      base = base.filter((e) => {
        const d = new Date(e.nextOccurrence?.dateTime ?? e.dateTime);
        if (d.getFullYear() !== selectedYear) return false;
        if (selectedMonth !== null && d.getMonth() !== selectedMonth) return false;
        return true;
      });
    }
    if (selectedDay !== null) {
      base = base.filter((e) => getEventDay(e) === selectedDay);
    }
    return base;
  }, [events, selectedYear, selectedMonth, selectedDay]);

  // ── Filter counts (per status, from preStatusBase) ─────────────────
  const filterCounts = useMemo(() => ({
    upcoming: preStatusBase.filter((e) => !e.isPast).length,
    all:     preStatusBase.length,
    new:     preStatusBase.filter((e) => !e.isPast && isEventNew(e, lastLogin)).length,
    updated: preStatusBase.filter((e) => !e.isPast && isEventUpdated(e, lastLogin)).length,
    full:    preStatusBase.filter((e) => e.isFull).length,
    past:    preStatusBase.filter((e) => e.isPast).length,
    booked:  preStatusBase.filter((e) => !e.isPast && e.userRsvp !== null).length,
    toPay:   preStatusBase.filter((e) => !e.isPast && e.userRsvp !== null && (e.costAmount ?? 0) > 0 && e.userRsvp.paymentStatus === null).length,
  }), [preStatusBase, lastLogin]);

  // ── Filtered events ────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    let base: EventSummary[];
    switch (activeFilter) {
      case "all":     base = preStatusBase; break;
      case "new":     base = preStatusBase.filter((e) => !e.isPast && isEventNew(e, lastLogin)); break;
      case "updated": base = preStatusBase.filter((e) => !e.isPast && isEventUpdated(e, lastLogin)); break;
      case "full":    base = preStatusBase.filter((e) => e.isFull); break;
      case "past":    base = preStatusBase.filter((e) => e.isPast); break;
      case "booked":  base = preStatusBase.filter((e) => !e.isPast && e.userRsvp !== null); break;
      case "toPay":   base = preStatusBase.filter((e) => !e.isPast && e.userRsvp !== null && (e.costAmount ?? 0) > 0 && e.userRsvp.paymentStatus === null); break;
      default:        base = preStatusBase.filter((e) => !e.isPast);
    }
    return base;
  }, [preStatusBase, activeFilter, lastLogin]);

  function setView(v: View) {
    const params = new URLSearchParams(searchParams.toString());
    if (v === "list") {
      params.delete("view");
    } else {
      params.set("view", v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const viewButtons: { value: View; label: string }[] = [
    { value: "list", label: "List" },
    { value: "map", label: "Map" },
    { value: "combined", label: "Combined" },
  ];

  type FilterDef = {
    key: FilterKey;
    label: string;
    selectedCls: string;
    loggedInOnly?: boolean;
  };

  const filterDefs: FilterDef[] = [
    {
      key: "all",
      label: "Show all",
      selectedCls: "bg-gray-800 text-white border-gray-800",
    },
    {
      key: "new",
      label: "New",
      selectedCls: "bg-blue-600 text-white border-blue-600",
    },
    {
      key: "updated",
      label: "Updated",
      selectedCls: "bg-teal-600 text-white border-teal-600",
    },
    {
      key: "full",
      label: "Full",
      selectedCls: "bg-red-600 text-white border-red-600",
    },
    {
      key: "past",
      label: "Past",
      selectedCls: "bg-orange-500 text-white border-orange-500",
    },
    {
      key: "booked",
      label: "Booked",
      selectedCls: "bg-green-600 text-white border-green-600",
      loggedInOnly: true,
    },
    {
      key: "toPay",
      label: "To Pay",
      selectedCls: "bg-yellow-500 text-white border-yellow-500",
      loggedInOnly: true,
    },
  ];

  const unselectedCls = "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50";
  const upcomingSelected = activeFilter === null;

  return (
    <>
      {/* Status filter pills */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {/* Show all — leftmost */}
        {(() => {
          const def = filterDefs.find((f) => f.key === "all")!;
          const active = activeFilter === "all";
          return (
            <button
              key="all"
              type="button"
              onClick={() => selectFilter("all")}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition shadow-sm ${
                active ? `${def.selectedCls} shadow-inner` : unselectedCls
              }`}
            >
              {def.label} ({filterCounts.all})
            </button>
          );
        })()}

        {/* Upcoming */}
        <button
          type="button"
          onClick={() => setActiveFilter(null)}
          className={`rounded-full border px-3 py-1 text-sm font-medium transition shadow-sm ${
            upcomingSelected
              ? "bg-indigo-600 text-white border-indigo-600 shadow-inner"
              : unselectedCls
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

      {/* Day-of-week filter pills */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {DAYS_MON_FIRST.map((d) => {
          const active = selectedDay === d;
          const cls = DAY_PILL_CLS[d];
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition shadow-sm ${
                active ? `${cls.on} shadow-inner` : cls.off
              }`}
            >
              {DAY_ABBR[d]}
            </button>
          );
        })}
      </div>

      {/* View toggle + year/month filter */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {viewButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setView(btn.value)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                view === btn.value
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {years.length > 1 && (
          <select
            value={selectedYear ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedYear(val === "" ? null : parseInt(val, 10));
              setSelectedMonth(null);
            }}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none"
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}

        {selectedYear !== null && months.length > 1 && (
          <select
            value={selectedMonth ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedMonth(val === "" ? null : parseInt(val, 10));
            }}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none"
          >
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>{MONTH_NAMES[m]}</option>
            ))}
          </select>
        )}
      </div>

      {view === "list" && (
        <EventsHierarchy
          events={filteredEvents}
          lastLogin={lastLogin}
          drill={locationDrill}
          onDrill={setLocationDrill}
        />
      )}
      {view === "map" && (
        <LeafletMap
          events={filteredEvents}
          allEvents={events}
          userLastLogin={lastLogin}
          drill={locationDrill}
          onDrill={setLocationDrill}
        />
      )}
      {view === "combined" && (
        <EventsCombined
          events={filteredEvents}
          allEvents={events}
          lastLogin={lastLogin}
          homeCity={homeCity}
        />
      )}
    </>
  );
}

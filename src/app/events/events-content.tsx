"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { EventSummary } from "@/types";
import { isEventFresh } from "@/lib/event-utils";
import { EventsHierarchy } from "./events-hierarchy";

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((m) => m.LeafletMap),
  { ssr: false, loading: () => <p className="mt-8 text-gray-400">Loading map...</p> },
);

type View = "list" | "map";

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

export function EventsContent({ events, initialView, homeCity, lastLogin, userId }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view = (searchParams.get("view") as View) ?? initialView;

  // ── Status filter state ────────────────────────────────────────────
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  function toggleFilter(f: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
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

  // ── Filtered events ────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    // Step 1: status filter
    let base: EventSummary[];
    if (activeFilters.size === 0) {
      base = events.filter((e) => !e.isPast);
    } else {
      const ids = new Set<string>();
      const add = (arr: EventSummary[]) => arr.forEach((e) => ids.add(e.id));
      if (activeFilters.has("new"))
        add(events.filter((e) => !e.isPast && isEventFresh(e, lastLogin)));
      if (activeFilters.has("full"))
        add(events.filter((e) => e.isFull));
      if (activeFilters.has("past"))
        add(events.filter((e) => e.isPast));
      if (activeFilters.has("booked"))
        add(events.filter((e) => !e.isPast && e.userRsvp !== null));
      if (activeFilters.has("toPay"))
        add(events.filter((e) =>
          !e.isPast &&
          e.userRsvp !== null &&
          (e.costAmount ?? 0) > 0 &&
          e.userRsvp.paymentStatus === null
        ));
      base = events.filter((e) => ids.has(e.id));
    }

    // Step 2: year/month filter
    if (selectedYear !== null) {
      base = base.filter((e) => {
        const d = new Date(e.nextOccurrence?.dateTime ?? e.dateTime);
        if (d.getFullYear() !== selectedYear) return false;
        if (selectedMonth !== null && d.getMonth() !== selectedMonth) return false;
        return true;
      });
    }

    return base;
  }, [events, activeFilters, lastLogin, selectedYear, selectedMonth]);

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
  ];

  type FilterDef = {
    key: string;
    label: string;
    on: string;
    off: string;
    loggedInOnly?: boolean;
  };

  const filterDefs: FilterDef[] = [
    {
      key: "new",
      label: "New",
      on: "bg-blue-100 border-blue-400 text-blue-700",
      off: "border-blue-300 text-blue-600 hover:bg-blue-50",
    },
    {
      key: "full",
      label: "Full",
      on: "bg-red-100 border-red-400 text-red-700",
      off: "border-red-300 text-red-600 hover:bg-red-50",
    },
    {
      key: "past",
      label: "Past",
      on: "bg-orange-100 border-orange-400 text-orange-700",
      off: "border-orange-300 text-orange-600 hover:bg-orange-50",
    },
    {
      key: "booked",
      label: "Booked",
      on: "bg-green-100 border-green-400 text-green-700",
      off: "border-green-300 text-green-600 hover:bg-green-50",
      loggedInOnly: true,
    },
    {
      key: "toPay",
      label: "To Pay",
      on: "bg-yellow-100 border-yellow-400 text-yellow-700",
      off: "border-yellow-300 text-yellow-600 hover:bg-yellow-50",
      loggedInOnly: true,
    },
  ];

  return (
    <>
      {/* Status filter pills */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {filterDefs
          .filter((f) => !f.loggedInOnly || userId !== null)
          .map((f) => {
            const active = activeFilters.has(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  active ? f.on : f.off
                }`}
              >
                {f.label}
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
        <EventsHierarchy events={filteredEvents} homeCity={homeCity} lastLogin={lastLogin} />
      )}
      {view === "map" && (
        <LeafletMap events={filteredEvents} homeCity={homeCity} userLastLogin={lastLogin} />
      )}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { EventsList } from "./events-list";
import type { EventSummary } from "@/types";

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((m) => m.LeafletMap),
  { ssr: false, loading: () => <p className="mt-8 text-gray-400">Loading map...</p> },
);

type View = "list" | "map";

interface Props {
  events: EventSummary[];
  initialView: View;
  defaultCity: string | null;
}

export function EventsContent({ events, initialView, defaultCity }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view = (searchParams.get("view") as View) ?? initialView;

  // Extract unique city names from the events data
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.location.city);
    return Array.from(set).sort();
  }, [events]);

  // Default to user's home city if it matches an available city, else "All"
  const initialCity =
    defaultCity && cities.includes(defaultCity) ? defaultCity : "";
  const [selectedCity, setSelectedCity] = useState(initialCity);

  const filteredEvents = useMemo(
    () =>
      selectedCity
        ? events.filter((e) => e.location.city === selectedCity)
        : events,
    [events, selectedCity],
  );

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

  const buttons: { value: View; label: string }[] = [
    { value: "list", label: "List" },
    { value: "map", label: "Map" },
  ];

  return (
    <>
      {/* View toggle + city filter */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {buttons.map((btn) => (
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

        {cities.length > 1 && (
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300"
          >
            <option value="">All cities ({events.length})</option>
            {cities.map((c) => {
              const count = events.filter((e) => e.location.city === c).length;
              return (
                <option key={c} value={c}>
                  {c} ({count})
                </option>
              );
            })}
          </select>
        )}
      </div>

      {view === "list" && <EventsList events={filteredEvents} />}
      {view === "map" && (
        <LeafletMap events={filteredEvents} homeCity={selectedCity || null} />
      )}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { EventSummary } from "@/types";
import { EventsHierarchy } from "./events-hierarchy";

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((m) => m.LeafletMap),
  { ssr: false, loading: () => <p className="mt-8 text-gray-400">Loading map...</p> },
);

type View = "list" | "map";

interface Props {
  events: EventSummary[];
  initialView: View;
  homeCity: string | null;
  lastLogin: string | null;
}

export function EventsContent({ events, initialView, homeCity, lastLogin }: Props) {
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
  const defaultCity = homeCity ?? "";
  const initialCity = defaultCity && cities.includes(defaultCity) ? defaultCity : "";
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

      </div>

      {view === "list" && (
        <EventsHierarchy events={events} homeCity={homeCity} lastLogin={lastLogin} />
      )}
      {view === "map" && (
        <LeafletMap events={events} homeCity={homeCity} userLastLogin={lastLogin} />
      )}
    </>
  );
}

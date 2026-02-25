"use client";

import { lazy, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { EventsList } from "./events-list";
import { MapView } from "./map-view";
import type { EventSummary } from "@/types";

const MapV2 = lazy(() =>
  import("./map-v2").then((m) => ({ default: m.MapV2 })),
);

type View = "list" | "map" | "mapv2";

interface Props {
  events: EventSummary[];
  initialView: View;
}

export function EventsContent({ events, initialView }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view = (searchParams.get("view") as View) ?? initialView;

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
    { value: "mapv2", label: "Map V2" },
  ];

  return (
    <>
      <div className="mt-6 flex gap-2">
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

      {view === "list" && <EventsList events={events} />}
      {view === "map" && <MapView events={events} />}
      {view === "mapv2" && (
        <Suspense
          fallback={
            <p className="mt-8 text-gray-400">Loading map...</p>
          }
        >
          <MapV2 events={events} />
        </Suspense>
      )}
    </>
  );
}

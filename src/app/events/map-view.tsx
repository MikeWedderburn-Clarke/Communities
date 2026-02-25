"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RoleBadges } from "@/components/role-badges";
import { buildLocationHierarchy } from "@/lib/location-hierarchy";
import type { EventSummary } from "@/types";

type DrillLevel =
  | { level: "globe" }
  | { level: "country"; country: string }
  | { level: "city"; country: string; city: string }
  | { level: "venue"; country: string; city: string; venue: string };

interface Props {
  events: EventSummary[];
}

export function MapView({ events }: Props) {
  const [drill, setDrill] = useState<DrillLevel>({ level: "globe" });
  const hierarchy = useMemo(() => buildLocationHierarchy(events), [events]);

  return (
    <div className="mt-6">
      <Breadcrumbs drill={drill} onNavigate={setDrill} />
      <div className="mt-4">
        {drill.level === "globe" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hierarchy.map((country) => (
              <button
                key={country.country}
                onClick={() => setDrill({ level: "country", country: country.country })}
                className="rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
              >
                <h3 className="text-lg font-semibold">{country.country}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {country.eventCount} {country.eventCount === 1 ? "event" : "events"}
                </p>
                <p className="text-sm text-gray-500">
                  {country.cities.length} {country.cities.length === 1 ? "city" : "cities"}
                </p>
              </button>
            ))}
          </div>
        )}

        {drill.level === "country" && (() => {
          const country = hierarchy.find((c) => c.country === drill.country);
          if (!country) return <p className="text-gray-500">Country not found.</p>;
          return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {country.cities.map((city) => (
                <button
                  key={city.city}
                  onClick={() => setDrill({ level: "city", country: drill.country, city: city.city })}
                  className="rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{city.city}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {city.eventCount} {city.eventCount === 1 ? "event" : "events"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {city.venues.length} {city.venues.length === 1 ? "venue" : "venues"}
                  </p>
                </button>
              ))}
            </div>
          );
        })()}

        {drill.level === "city" && (() => {
          const country = hierarchy.find((c) => c.country === drill.country);
          const city = country?.cities.find((ci) => ci.city === drill.city);
          if (!city) return <p className="text-gray-500">City not found.</p>;
          return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {city.venues.map((venue) => (
                <button
                  key={venue.venue}
                  onClick={() => setDrill({ level: "venue", country: drill.country, city: drill.city, venue: venue.venue })}
                  className="rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{venue.venue}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {venue.eventCount} {venue.eventCount === 1 ? "event" : "events"}
                  </p>
                </button>
              ))}
            </div>
          );
        })()}

        {drill.level === "venue" && (() => {
          const country = hierarchy.find((c) => c.country === drill.country);
          const city = country?.cities.find((ci) => ci.city === drill.city);
          const venue = city?.venues.find((v) => v.venue === drill.venue);
          if (!venue) return <p className="text-gray-500">Venue not found.</p>;
          return (
            <ul className="space-y-4">
              {venue.events.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold">{event.title}</h2>
                        <p className="mt-1 text-sm text-gray-600">
                          {formatDateTime(event.dateTime)}
                        </p>
                        <p className="text-sm text-gray-500">{event.location}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-medium text-indigo-600">
                          {event.attendeeCount} going
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <RoleBadges roleCounts={event.roleCounts} teacherCount={event.teacherCount} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          );
        })()}
      </div>
    </div>
  );
}

function Breadcrumbs({ drill, onNavigate }: { drill: DrillLevel; onNavigate: (d: DrillLevel) => void }) {
  const crumbs: { label: string; action?: () => void }[] = [];

  if (drill.level === "globe") {
    crumbs.push({ label: "All locations" });
  } else {
    crumbs.push({ label: "All locations", action: () => onNavigate({ level: "globe" }) });
  }

  if (drill.level === "country") {
    crumbs.push({ label: drill.country });
  } else if (drill.level === "city" || drill.level === "venue") {
    crumbs.push({ label: drill.country, action: () => onNavigate({ level: "country", country: drill.country }) });
  }

  if (drill.level === "city") {
    crumbs.push({ label: drill.city });
  } else if (drill.level === "venue") {
    crumbs.push({ label: drill.city, action: () => onNavigate({ level: "city", country: drill.country, city: drill.city }) });
  }

  if (drill.level === "venue") {
    crumbs.push({ label: drill.venue });
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span>/</span>}
          {crumb.action ? (
            <button onClick={crumb.action} className="text-indigo-600 hover:underline">
              {crumb.label}
            </button>
          ) : (
            <span className="font-semibold text-gray-900">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

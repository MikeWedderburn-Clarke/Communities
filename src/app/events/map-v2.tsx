"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from "react-simple-maps";
import { RoleBadges } from "@/components/role-badges";
import { buildLocationHierarchy } from "@/lib/location-hierarchy";
import { CITY_COORDS, COUNTRY_CENTERS } from "@/data/city-coords";
import type { EventSummary } from "@/types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type DrillLevel =
  | { level: "globe" }
  | { level: "country"; country: string }
  | { level: "city"; country: string; city: string }
  | { level: "venue"; country: string; city: string; venue: string };

interface Props {
  events: EventSummary[];
}

export function MapV2({ events }: Props) {
  const [drill, setDrill] = useState<DrillLevel>({ level: "globe" });
  const hierarchy = useMemo(() => buildLocationHierarchy(events), [events]);

  const countriesWithEvents = useMemo(
    () => new Set(hierarchy.map((c) => c.country)),
    [hierarchy],
  );

  return (
    <div className="mt-6">
      <Breadcrumbs drill={drill} onNavigate={setDrill} />
      <div className="mt-4">
        {drill.level === "globe" && (
          <GlobeView
            hierarchy={hierarchy}
            countriesWithEvents={countriesWithEvents}
            onSelectCountry={(country) =>
              setDrill({ level: "country", country })
            }
          />
        )}

        {drill.level === "country" && (() => {
          const country = hierarchy.find((c) => c.country === drill.country);
          if (!country) return <p className="text-gray-500">Country not found.</p>;
          return (
            <CountryView
              country={country}
              onSelectCity={(city) =>
                setDrill({ level: "city", country: drill.country, city })
              }
            />
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
                  onClick={() =>
                    setDrill({
                      level: "venue",
                      country: drill.country,
                      city: drill.city,
                      venue: venue.venue,
                    })
                  }
                  className="rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{venue.venue}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {venue.eventCount}{" "}
                    {venue.eventCount === 1 ? "event" : "events"}
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
                        <p className="text-sm text-gray-500">
                          {event.location}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-medium text-indigo-600">
                          {event.attendeeCount} going
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <RoleBadges
                        roleCounts={event.roleCounts}
                        teacherCount={event.teacherCount}
                      />
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

/* ── Globe level: world map with highlighted countries ───────────── */

function GlobeView({
  hierarchy,
  countriesWithEvents,
  onSelectCountry,
}: {
  hierarchy: ReturnType<typeof buildLocationHierarchy>;
  countriesWithEvents: Set<string>;
  onSelectCountry: (country: string) => void;
}) {
  const countryEventCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of hierarchy) map.set(c.country, c.eventCount);
    return map;
  }, [hierarchy]);

  /* Map from TopoJSON NAME property → our country name.
     Natural Earth 110m uses: "United Kingdom", "United States of America", etc. */
  const nameMapping: Record<string, string> = {
    "United States of America": "United States",
  };

  function resolveCountry(geoName: string): string {
    return nameMapping[geoName] ?? geoName;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 120, center: [10, 30] }}
        width={800}
        height={450}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const geoName = geo.properties.name as string;
              const resolved = resolveCountry(geoName);
              const hasEvents = countriesWithEvents.has(resolved);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => {
                    if (hasEvents) onSelectCountry(resolved);
                  }}
                  style={{
                    default: {
                      fill: hasEvents ? "#818cf8" : "#e5e7eb",
                      stroke: "#fff",
                      strokeWidth: 0.5,
                      outline: "none",
                      cursor: hasEvents ? "pointer" : "default",
                    },
                    hover: {
                      fill: hasEvents ? "#6366f1" : "#d1d5db",
                      stroke: "#fff",
                      strokeWidth: 0.5,
                      outline: "none",
                      cursor: hasEvents ? "pointer" : "default",
                    },
                    pressed: {
                      fill: hasEvents ? "#4f46e5" : "#e5e7eb",
                      stroke: "#fff",
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Country legend below the map */}
      {hierarchy.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3">
          <div className="flex flex-wrap gap-3">
            {hierarchy.map((c) => (
              <button
                key={c.country}
                onClick={() => onSelectCountry(c.country)}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-sm transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "#818cf8" }}
                />
                <span className="font-medium">{c.country}</span>
                <span className="text-gray-500">
                  {c.eventCount} {c.eventCount === 1 ? "event" : "events"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Country level: zoomed map with city markers ────────────────── */

function CountryView({
  country,
  onSelectCity,
}: {
  country: ReturnType<typeof buildLocationHierarchy>[number];
  onSelectCity: (city: string) => void;
}) {
  const countryCenter = COUNTRY_CENTERS[country.country];
  const center = countryCenter ? countryCenter.center : [0, 20] as [number, number];
  const zoom = countryCenter ? countryCenter.zoom : 4;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 120 * zoom,
          center: center as [number, number],
        }}
        width={800}
        height={500}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: {
                    fill: "#f3f4f6",
                    stroke: "#d1d5db",
                    strokeWidth: 0.5,
                    outline: "none",
                  },
                  hover: {
                    fill: "#f3f4f6",
                    stroke: "#d1d5db",
                    strokeWidth: 0.5,
                    outline: "none",
                  },
                  pressed: {
                    fill: "#f3f4f6",
                    stroke: "#d1d5db",
                    strokeWidth: 0.5,
                    outline: "none",
                  },
                }}
              />
            ))
          }
        </Geographies>

        {/* City markers */}
        {country.cities.map((city) => {
          const coords = CITY_COORDS[city.city];
          if (!coords) return null;
          return (
            <Marker
              key={city.city}
              coordinates={[coords.lng, coords.lat]}
              onClick={() => onSelectCity(city.city)}
              style={{ cursor: "pointer" }}
            >
              <circle r={6} fill="#6366f1" stroke="#fff" strokeWidth={2} />
              <text
                textAnchor="middle"
                y={-12}
                style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "11px",
                  fontWeight: 600,
                  fill: "#1e1b4b",
                }}
              >
                {city.city}
              </text>
              <text
                textAnchor="middle"
                y={-1}
                style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "8px",
                  fill: "#fff",
                  fontWeight: 700,
                }}
              >
                {city.eventCount}
              </text>
            </Marker>
          );
        })}

        {/* Cities without coordinates: show a note */}
      </ComposableMap>

      {/* City list below the map for cities without coords */}
      {(() => {
        const missing = country.cities.filter((c) => !CITY_COORDS[c.city]);
        if (missing.length === 0) return null;
        return (
          <div className="border-t border-gray-100 px-5 py-3">
            <p className="mb-2 text-xs text-gray-400">
              Not shown on map:
            </p>
            <div className="flex flex-wrap gap-3">
              {missing.map((c) => (
                <button
                  key={c.city}
                  onClick={() => onSelectCity(c.city)}
                  className="rounded-full border border-gray-200 px-3 py-1 text-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <span className="font-medium">{c.city}</span>{" "}
                  <span className="text-gray-500">
                    {c.eventCount} {c.eventCount === 1 ? "event" : "events"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Breadcrumbs ────────────────────────────────────────────────── */

function Breadcrumbs({
  drill,
  onNavigate,
}: {
  drill: DrillLevel;
  onNavigate: (d: DrillLevel) => void;
}) {
  const crumbs: { label: string; action?: () => void }[] = [];

  if (drill.level === "globe") {
    crumbs.push({ label: "World map" });
  } else {
    crumbs.push({
      label: "World map",
      action: () => onNavigate({ level: "globe" }),
    });
  }

  if (drill.level === "country") {
    crumbs.push({ label: drill.country });
  } else if (drill.level === "city" || drill.level === "venue") {
    crumbs.push({
      label: drill.country,
      action: () =>
        onNavigate({ level: "country", country: drill.country }),
    });
  }

  if (drill.level === "city") {
    crumbs.push({ label: drill.city });
  } else if (drill.level === "venue") {
    crumbs.push({
      label: drill.city,
      action: () =>
        onNavigate({
          level: "city",
          country: drill.country,
          city: drill.city,
        }),
    });
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
            <button
              onClick={crumb.action}
              className="text-indigo-600 hover:underline"
            >
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

/* ── Helpers ─────────────────────────────────────────────────────── */

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

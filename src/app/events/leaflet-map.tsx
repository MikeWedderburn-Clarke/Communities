"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import type { EventSummary } from "@/types";

import "leaflet/dist/leaflet.css";

// ── Discrete zoom levels ───────────────────────────────────────────

type Level = 1 | 2 | 3;

const LEVEL_ZOOM: Record<Level, number> = { 1: 2, 2: 5, 3: 12 };
const LEVEL_LABEL: Record<Level, string> = {
  1: "Globe",
  2: "Country",
  3: "City",
};

// ── Icon factories ─────────────────────────────────────────────────

/** Circular bubble for Globe and Country levels — clickable to drill down. */
function bubbleIcon(line1: string, line2: string, color: string, size = 52) {
  return L.divIcon({
    html: `<div style="
      background:${color};
      color:#fff;
      border-radius:50%;
      width:${size}px;
      height:${size}px;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      font-weight:700;
      font-size:11px;
      border:3px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.3);
      text-align:center;
      line-height:1.25;
      padding:2px;
      box-sizing:border-box;
      cursor:pointer;
    "><span>${line1}</span><span style="font-weight:400;font-size:10px">${line2}</span></div>`,
    className: "",
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
}

/**
 * Pill-shaped icon for City level.
 * Shows truncated event title; clicking navigates to the event page.
 */
function eventPillIcon(title: string) {
  const MAX = 24;
  const label = title.length > MAX ? title.slice(0, MAX - 1) + "\u2026" : title;
  const W = 170;
  return L.divIcon({
    html: `<div style="
      background:#059669;
      color:#fff;
      border-radius:999px;
      padding:5px 12px;
      font-size:11px;
      font-weight:600;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.3);
      cursor:pointer;
      width:${W}px;
      box-sizing:border-box;
    " title="${title}">${label}</div>`,
    className: "",
    iconSize: L.point(W, 28),
    iconAnchor: L.point(W / 2, 14),
  });
}

// ── MapController ──────────────────────────────────────────────────
// Renders nothing; uses useMap() to fly to the new level/center when
// the user changes level.  Skips the initial mount to avoid animating
// over the position MapContainer already set.

function MapController({
  level,
  center,
}: {
  level: Level;
  center: [number, number];
}) {
  const map = useMap();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    map.flyTo(center, LEVEL_ZOOM[level], { duration: 0.75 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, center[0], center[1]]);

  return null;
}

// ── Centroid helpers ───────────────────────────────────────────────

function centroid(pts: { lat: number; lng: number }[]): [number, number] {
  const n = pts.length;
  return [
    pts.reduce((s, p) => s + p.lat, 0) / n,
    pts.reduce((s, p) => s + p.lng, 0) / n,
  ];
}

// ── Main component ─────────────────────────────────────────────────

interface Props {
  events: EventSummary[];
  homeCity?: string | null;
}

export function LeafletMap({ events, homeCity }: Props) {
  // ── Aggregate events by country and by city ──────────────────────
  const byCountry = useMemo(() => {
    const m = new Map<string, { pts: { lat: number; lng: number }[]; count: number }>();
    for (const e of events) {
      const key = e.location.country;
      if (!m.has(key)) m.set(key, { pts: [], count: 0 });
      const v = m.get(key)!;
      v.pts.push({ lat: e.location.latitude, lng: e.location.longitude });
      v.count++;
    }
    return Array.from(m.entries()).map(([country, d]) => ({
      country,
      center: centroid(d.pts),
      count: d.count,
    }));
  }, [events]);

  const byCity = useMemo(() => {
    const m = new Map<
      string,
      { city: string; country: string; pts: { lat: number; lng: number }[]; count: number }
    >();
    for (const e of events) {
      const key = `${e.location.city}||${e.location.country}`;
      if (!m.has(key))
        m.set(key, { city: e.location.city, country: e.location.country, pts: [], count: 0 });
      const v = m.get(key)!;
      v.pts.push({ lat: e.location.latitude, lng: e.location.longitude });
      v.count++;
    }
    return Array.from(m.values()).map((d) => ({
      city: d.city,
      country: d.country,
      center: centroid(d.pts),
      count: d.count,
    }));
  }, [events]);

  // ── Derive initial level / center ────────────────────────────────
  const allPts = events.map((e) => ({
    lat: e.location.latitude,
    lng: e.location.longitude,
  }));
  const globalCenter: [number, number] = allPts.length > 0 ? centroid(allPts) : [20, 0];

  const homeCityData = homeCity
    ? byCity.find((c) => c.city === homeCity) ?? null
    : null;

  const [level, setLevel] = useState<Level>(homeCityData ? 3 : 1);
  const [center, setCenter] = useState<[number, number]>(
    homeCityData ? homeCityData.center : globalCenter,
  );

  // ── Drill-down handlers (called by clicking a bubble marker) ─────
  function drillToCountry(c: (typeof byCountry)[number]) {
    setCenter(c.center);
    setLevel(2);
  }

  function drillToCity(c: (typeof byCity)[number]) {
    setCenter(c.center);
    setLevel(3);
  }

  // ── Zoom In / Out button handlers ────────────────────────────────
  function zoomIn() {
    if (level === 1) {
      if (homeCityData) {
        const countryEntry = byCountry.find((c) => c.country === homeCityData.country);
        setCenter(countryEntry?.center ?? globalCenter);
      } else {
        setCenter(globalCenter);
      }
      setLevel(2);
    } else if (level === 2) {
      if (homeCityData) {
        setCenter(homeCityData.center);
      } else if (byCity.length > 0) {
        const biggest = byCity.reduce((a, b) => (b.count > a.count ? b : a));
        setCenter(biggest.center);
      }
      setLevel(3);
    }
  }

  function zoomOut() {
    if (level === 3) {
      setLevel(2);
    } else if (level === 2) {
      setCenter(globalCenter);
      setLevel(1);
    }
  }

  const hints: Record<Level, string> = {
    1: "Click a country to zoom in, or use the Zoom In button.",
    2: "Click a city to zoom in, or use the Zoom In button.",
    3: "Click an event name to view details.",
  };

  return (
    <div className="mt-6">
      {/* Level controls */}
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={zoomOut}
          disabled={level === 1}
          className="rounded border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Zoom Out
        </button>

        {/* Breadcrumb level indicator */}
        <div className="flex items-center gap-1 text-sm">
          {([1, 2, 3] as const).map((l, i) => (
            <span key={l} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300">›</span>}
              <span
                className={
                  l === level ? "font-semibold text-indigo-600" : "text-gray-400"
                }
              >
                {LEVEL_LABEL[l]}
              </span>
            </span>
          ))}
        </div>

        <button
          onClick={zoomIn}
          disabled={level === 3}
          className="rounded border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Zoom In →
        </button>
      </div>

      {/* Map */}
      <div
        className="overflow-hidden rounded-lg border border-gray-200 shadow-sm"
        style={{ height: "480px" }}
      >
        <MapContainer
          center={center}
          zoom={LEVEL_ZOOM[level]}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
          zoomControl={false}
          doubleClickZoom={false}
          touchZoom={false}
          keyboard={false}
        >
          <MapController level={level} center={center} />

          {/* CartoDB Positron — clean, minimal, free, no API key needed */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />

          {/* Level 1 — Globe: one bubble per country */}
          {level === 1 &&
            byCountry.map((c) => (
              <Marker
                key={c.country}
                position={c.center}
                icon={bubbleIcon(
                  c.country,
                  `${c.count} event${c.count !== 1 ? "s" : ""}`,
                  "#6366f1",
                  56,
                )}
                eventHandlers={{ click: () => drillToCountry(c) }}
              />
            ))}

          {/* Level 2 — Country: one bubble per city */}
          {level === 2 &&
            byCity.map((c) => (
              <Marker
                key={`${c.city}-${c.country}`}
                position={c.center}
                icon={bubbleIcon(
                  c.city,
                  `${c.count} event${c.count !== 1 ? "s" : ""}`,
                  "#0ea5e9",
                  52,
                )}
                eventHandlers={{ click: () => drillToCity(c) }}
              />
            ))}

          {/* Level 3 — City: one pill per event showing the event name */}
          {level === 3 &&
            events.map((event) => (
              <Marker
                key={event.id}
                position={[event.location.latitude, event.location.longitude]}
                icon={eventPillIcon(event.title)}
                eventHandlers={{
                  click: () => {
                    window.location.href = `/events/${event.id}`;
                  },
                }}
              />
            ))}
        </MapContainer>
      </div>

      <p className="mt-2 text-xs text-gray-400">{hints[level]}</p>
    </div>
  );
}

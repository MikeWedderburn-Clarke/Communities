"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { BreadcrumbNav } from "./breadcrumbs";
import { normalizeCityName } from "@/lib/city-utils";
import { isEventFresh } from "@/lib/event-utils";
import type { EventSummary } from "@/types";

import "leaflet/dist/leaflet.css";

type Level = 1 | 2 | 3;
const LEVEL_ZOOM: Record<Level, number> = { 1: 2, 2: 5, 3: 12 };

interface CityEntry {
  city: string;
  country: string;
  count: number;
  center: [number, number];
  bounds: [[number, number], [number, number]];
}

interface CountryEntry {
  country: string;
  count: number;
  center: [number, number];
}

interface Props {
  events: EventSummary[];
  homeCity?: string | null;
  userLastLogin: string | null;
}

export function LeafletMap({ events, homeCity, userLastLogin }: Props) {
  const normalizedHomeCity = normalizeCityName(homeCity) ?? homeCity ?? null;

  const { cityEntries, countryEntries, cityMap, countryMap } = useMemo(() => {
    const cityStats = new Map<string, { city: string; country: string; pts: { lat: number; lng: number }[]; count: number }>();
    for (const event of events) {
      const canonicalCity = normalizeCityName(event.location.city) ?? event.location.city;
      const key = `${canonicalCity}||${event.location.country}`;
      if (!cityStats.has(key)) {
        cityStats.set(key, { city: canonicalCity, country: event.location.country, pts: [], count: 0 });
      }
      const entry = cityStats.get(key)!;
      entry.pts.push({ lat: event.location.latitude, lng: event.location.longitude });
      entry.count++;
    }

    const countryStats = new Map<string, { pts: { lat: number; lng: number }[]; count: number }>();
    for (const entry of cityStats.values()) {
      const country = entry.country;
      const stats = countryStats.get(country) ?? { pts: [], count: 0 };
      stats.pts.push(...entry.pts);
      stats.count += entry.count;
      countryStats.set(country, stats);
    }

    const cities: CityEntry[] = [];
    const cityLookup = new Map<string, CityEntry>();
    for (const entry of cityStats.values()) {
      if (entry.pts.length === 0) continue;
      const center = centroid(entry.pts);
      const bounds = buildBounds(entry.pts);
      const record: CityEntry = {
        city: entry.city,
        country: entry.country,
        count: entry.count,
        center,
        bounds,
      };
      const mapKey = `${entry.city}||${entry.country}`;
      cities.push(record);
      cityLookup.set(mapKey, record);
    }

    const countries: CountryEntry[] = [];
    const countryLookup = new Map<string, CountryEntry>();
    for (const [country, stats] of countryStats.entries()) {
      if (stats.pts.length === 0) continue;
      const center = centroid(stats.pts);
      const record: CountryEntry = { country, count: stats.count, center };
      countries.push(record);
      countryLookup.set(country, record);
    }

    cities.sort((a, b) => a.city.localeCompare(b.city));
    countries.sort((a, b) => a.country.localeCompare(b.country));

    return { cityEntries: cities, countryEntries: countries, cityMap: cityLookup, countryMap: countryLookup };
  }, [events]);

  const globalCenter = useMemo(() => {
    if (events.length === 0) return [20, 0] as [number, number];
    const pts = events.map((event) => ({ lat: event.location.latitude, lng: event.location.longitude }));
    return centroid(pts);
  }, [events]);

  const initialCity = normalizedHomeCity ? cityEntries.find((c) => c.city === normalizedHomeCity) : undefined;
  const [level, setLevel] = useState<Level>(initialCity ? 3 : 1);
  const [activeCountry, setActiveCountry] = useState<string | null>(initialCity?.country ?? null);
  const [activeCity, setActiveCity] = useState<string | null>(initialCity?.city ?? null);

  const freshEventIds = useMemo(
    () => new Set(events.filter((event) => isEventFresh(event, userLastLogin)).map((event) => event.id)),
    [events, userLastLogin],
  );

  const currentCenter = useMemo<[number, number]>(() => {
    if (level === 3 && activeCity && activeCountry) {
      return cityMap.get(`${activeCity}||${activeCountry}`)?.center ?? globalCenter;
    }
    if (level === 2 && activeCountry) {
      return countryMap.get(activeCountry)?.center ?? globalCenter;
    }
    return globalCenter;
  }, [level, activeCity, activeCountry, cityMap, countryMap, globalCenter]);

  const currentBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (level === 3 && activeCity && activeCountry) {
      return cityMap.get(`${activeCity}||${activeCountry}`)?.bounds ?? null;
    }
    return null;
  }, [level, activeCity, activeCountry, cityMap]);

  const breadcrumbItems = useMemo(() => {
    const items = [] as { label: string; action?: () => void }[];
    items.push({ label: "Globe", action: level === 1 ? undefined : () => handleGlobe() });
    if (activeCountry) {
      items.push({
        label: activeCountry,
        action: level === 2 ? undefined : () => handleCountry(activeCountry),
      });
    }
    if (activeCity && activeCountry) {
      items.push({
        label: activeCity,
        action: level === 3 ? undefined : () => handleCity(activeCountry, activeCity),
      });
    }
    return items;
  }, [level, activeCountry, activeCity]);

  function handleGlobe() {
    setLevel(1);
    setActiveCountry(null);
    setActiveCity(null);
  }

  function handleCountry(country: string) {
    setLevel(2);
    setActiveCountry(country);
    setActiveCity(null);
  }

  function handleCity(country: string, city: string) {
    setLevel(3);
    setActiveCountry(country);
    setActiveCity(city);
  }

  if (events.length === 0) {
    return <p className="mt-6 text-gray-500">No events to show yet.</p>;
  }

  const citiesForActiveCountry = activeCountry
    ? cityEntries.filter((city) => city.country === activeCountry)
    : cityEntries;

  const cityEvents = events.filter((event) => {
    if (!activeCity || !activeCountry) return false;
    const canonical = normalizeCityName(event.location.city) ?? event.location.city;
    return canonical === activeCity && event.location.country === activeCountry;
  });

  return (
    <div className="mt-6 space-y-3">
      <BreadcrumbNav items={breadcrumbItems} />
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm" style={{ height: 480 }}>
        <MapContainer
          center={currentCenter}
          zoom={LEVEL_ZOOM[level]}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
          doubleClickZoom
          touchZoom
          keyboard={false}
          zoomControl={false}
        >
          <MapController center={currentCenter} zoom={LEVEL_ZOOM[level]} bounds={currentBounds} />
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />
          {level === 1 &&
            countryEntries.map((country) => (
              <Marker
                key={country.country}
                position={country.center}
                icon={countIcon(country.count, "#6366f1", `${country.country}: ${country.count} event${country.count !== 1 ? "s" : ""}`)}
                eventHandlers={{ click: () => handleCountry(country.country) }}
              />
            ))}
          {level === 2 &&
            citiesForActiveCountry.map((city) => (
              <Marker
                key={`${city.city}-${city.country}`}
                position={city.center}
                icon={countIcon(city.count, "#0ea5e9", `${city.city}: ${city.count} event${city.count !== 1 ? "s" : ""}`)}
                eventHandlers={{ click: () => handleCity(city.country, city.city) }}
              />
            ))}
          {level === 3 &&
            cityEvents.map((event) => (
              <Marker
                key={event.id}
                position={[event.location.latitude, event.location.longitude]}
                icon={eventPillIcon(event.title, freshEventIds.has(event.id))}
                eventHandlers={{ click: () => (window.location.href = `/events/${event.id}?from=map`) }}
              />
            ))}
        </MapContainer>
      </div>
    </div>
  );
}

function MapController({ center, bounds, zoom }: { center: [number, number]; bounds: [[number, number], [number, number]] | null; zoom: number }) {
  const map = useMap();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (bounds) {
        map.fitBounds(bounds, { padding: [24, 24] });
      } else {
        map.setView(center, zoom);
      }
      return;
    }
    if (bounds) {
      map.flyToBounds(bounds, { padding: [24, 24], duration: 0.75 });
    } else {
      map.flyTo(center, zoom, { duration: 0.75 });
    }
  }, [bounds, center, map, zoom]);

  return null;
}

function centroid(pts: { lat: number; lng: number }[]): [number, number] {
  if (pts.length === 0) return [20, 0];
  const lat = pts.reduce((sum, p) => sum + p.lat, 0) / pts.length;
  const lng = pts.reduce((sum, p) => sum + p.lng, 0) / pts.length;
  return [lat, lng];
}

function buildBounds(pts: { lat: number; lng: number }[]): [[number, number], [number, number]] {
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPadding = Math.max(0.02, (maxLat - minLat) * 0.1);
  const lngPadding = Math.max(0.02, (maxLng - minLng) * 0.1);
  return [[minLat - latPadding, minLng - lngPadding], [maxLat + latPadding, maxLng + lngPadding]];
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function countIcon(count: number, color: string, title?: string, size = 58) {
  const titleAttr = title ? `title="${escapeAttr(title)}"` : "";
  return L.divIcon({
    html: `<div ${titleAttr} style="background:${color};color:#fff;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">${count}</div>`,
    className: "",
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
}

function eventPillIcon(title: string, highlight: boolean) {
  const color = highlight ? "#dc2626" : "#059669";
  const label = title.length > 24 ? `${title.slice(0, 23)}…` : title;
  return L.divIcon({
    html: `<div title="${escapeAttr(title)}" style="background:${color};color:#fff;border-radius:999px;padding:5px 12px;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;box-sizing:border-box;">${label}</div>`,
    className: "",
    iconSize: L.point(160, 28),
    iconAnchor: L.point(80, 14),
  });
}

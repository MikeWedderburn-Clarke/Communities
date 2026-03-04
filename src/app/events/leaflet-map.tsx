"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvent } from "react-leaflet";
import L from "leaflet";
import { BreadcrumbNav } from "./breadcrumbs";
import { normalizeCityName } from "@/lib/city-utils";
import { getContinent } from "@/lib/location-hierarchy";
import { isEventFresh } from "@/lib/event-utils";
import { DAY_HEX, getEventDay } from "@/lib/day-utils";
import type { EventSummary } from "@/types";
import type { DrillState } from "./events-content";
import type { DateRange } from "./event-calendar";

import "leaflet/dist/leaflet.css";

// Level 1 = globe (continent markers)
// Level 2 = continent (country markers for that continent)
// Level 3 = country (city markers for that country)
// Level 4 = city (event pills)
type Level = 1 | 2 | 3 | 4;
const LEVEL_ZOOM: Record<Level, number> = { 1: 2, 2: 4, 3: 6, 4: 12 };

// Zoom thresholds: if user zooms below these, drill up one level
const ZOOM_DOWN_THRESHOLD: Record<2 | 3 | 4, number> = { 2: 2.5, 3: 4.5, 4: 8 };
// Zoom thresholds: if user zooms above these, drill into nearest entry
const ZOOM_UP_THRESHOLD: Record<1 | 2 | 3, number> = { 1: 3, 2: 5, 3: 9 };

interface ContinentEntry {
  continent: string;
  count: number;
  center: [number, number];
}

interface CityEntry {
  city: string;
  country: string;
  count: number;
  center: [number, number];
  bounds: [[number, number], [number, number]];
}

interface CountryEntry {
  country: string;
  continent: string;
  count: number;
  center: [number, number];
}

interface Props {
  events: EventSummary[];
  allEvents: EventSummary[];
  userLastLogin: string | null;
  drill: DrillState;
  onDrill: (d: DrillState) => void;
  dateRange?: DateRange | null;
  height?: number | string;
  /** When true: no outer mt-6 wrapper, no BreadcrumbNav, fills container height */
  embedded?: boolean;
}

export function LeafletMap({ events, allEvents, userLastLogin, drill, onDrill, dateRange = null, height = 480, embedded = false }: Props) {
  // Derive level/activeContinent/activeCountry/activeCity from shared drill state
  const level: Level =
    drill.level === "globe" ? 1 :
    drill.level === "continent" ? 2 :
    drill.level === "country" ? 3 : 4;

  const activeContinent = "continent" in drill ? drill.continent : null;
  const activeCountry = "country" in drill ? drill.country : null;
  const activeCity = "city" in drill ? drill.city : null;

  const { cityEntries, countryEntries, continentEntries, cityMap, countryMap, continentMap } = useMemo(() => {
    const cityStats = new Map<string, { city: string; country: string; pts: { lat: number; lng: number }[]; count: number }>();
    for (const event of allEvents) {
      const canonicalCity = normalizeCityName(event.location.city) ?? event.location.city;
      const key = `${canonicalCity}||${event.location.country}`;
      if (!cityStats.has(key)) {
        cityStats.set(key, { city: canonicalCity, country: event.location.country, pts: [], count: 0 });
      }
      const entry = cityStats.get(key)!;
      entry.pts.push({ lat: event.location.latitude, lng: event.location.longitude });
      entry.count++;
    }

    const countryStats = new Map<string, { continent: string; pts: { lat: number; lng: number }[]; count: number }>();
    for (const entry of cityStats.values()) {
      const country = entry.country;
      const continent = getContinent(country);
      const stats = countryStats.get(country) ?? { continent, pts: [], count: 0 };
      stats.pts.push(...entry.pts);
      stats.count += entry.count;
      countryStats.set(country, stats);
    }

    const continentStats = new Map<string, { pts: { lat: number; lng: number }[]; count: number }>();
    for (const [, stats] of countryStats.entries()) {
      const cs = continentStats.get(stats.continent) ?? { pts: [], count: 0 };
      cs.pts.push(...stats.pts);
      cs.count += stats.count;
      continentStats.set(stats.continent, cs);
    }

    const cities: CityEntry[] = [];
    const cityLookup = new Map<string, CityEntry>();
    for (const entry of cityStats.values()) {
      if (entry.pts.length === 0) continue;
      const center = centroid(entry.pts);
      const bounds = buildBounds(entry.pts);
      const record: CityEntry = { city: entry.city, country: entry.country, count: entry.count, center, bounds };
      const mapKey = `${entry.city}||${entry.country}`;
      cities.push(record);
      cityLookup.set(mapKey, record);
    }

    const countries: CountryEntry[] = [];
    const countryLookup = new Map<string, CountryEntry>();
    for (const [country, stats] of countryStats.entries()) {
      if (stats.pts.length === 0) continue;
      const center = centroid(stats.pts);
      const record: CountryEntry = { country, continent: stats.continent, count: stats.count, center };
      countries.push(record);
      countryLookup.set(country, record);
    }

    const continentsArr: ContinentEntry[] = [];
    const continentLookup = new Map<string, ContinentEntry>();
    for (const [continent, stats] of continentStats.entries()) {
      if (stats.pts.length === 0) continue;
      const center = centroid(stats.pts);
      const record: ContinentEntry = { continent, count: stats.count, center };
      continentsArr.push(record);
      continentLookup.set(continent, record);
    }

    cities.sort((a, b) => a.city.localeCompare(b.city));
    countries.sort((a, b) => a.country.localeCompare(b.country));
    continentsArr.sort((a, b) => a.continent.localeCompare(b.continent));

    return {
      cityEntries: cities,
      countryEntries: countries,
      continentEntries: continentsArr,
      cityMap: cityLookup,
      countryMap: countryLookup,
      continentMap: continentLookup,
    };
  }, [allEvents]);

  // Filtered counts (built from `events`, not `allEvents`) — used for bubble labels
  const { filteredCityCount, filteredCountryCount, filteredContinentCount } = useMemo(() => {
    const cityCount = new Map<string, number>();
    const countryCount = new Map<string, number>();
    const continentCount = new Map<string, number>();
    for (const event of events) {
      const canonicalCity = normalizeCityName(event.location.city) ?? event.location.city;
      const cityKey = `${canonicalCity}||${event.location.country}`;
      cityCount.set(cityKey, (cityCount.get(cityKey) ?? 0) + 1);
      countryCount.set(event.location.country, (countryCount.get(event.location.country) ?? 0) + 1);
      const cont = getContinent(event.location.country);
      continentCount.set(cont, (continentCount.get(cont) ?? 0) + 1);
    }
    return { filteredCityCount: cityCount, filteredCountryCount: countryCount, filteredContinentCount: continentCount };
  }, [events]);

  const globalCenter = useMemo(() => {
    if (events.length === 0) return [20, 0] as [number, number];
    const pts = events.map((event) => ({ lat: event.location.latitude, lng: event.location.longitude }));
    return centroid(pts);
  }, [events]);

  const freshEventIds = useMemo(
    () => new Set(events.filter((event) => isEventFresh(event, userLastLogin)).map((event) => event.id)),
    [events, userLastLogin],
  );

  const freshCountries = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) {
      if (freshEventIds.has(event.id)) set.add(event.location.country);
    }
    return set;
  }, [events, freshEventIds]);

  const freshContinents = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) {
      if (freshEventIds.has(event.id)) set.add(getContinent(event.location.country));
    }
    return set;
  }, [events, freshEventIds]);

  const freshCities = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) {
      if (freshEventIds.has(event.id)) {
        const canonical = normalizeCityName(event.location.city) ?? event.location.city;
        set.add(`${canonical}||${event.location.country}`);
      }
    }
    return set;
  }, [events, freshEventIds]);

  const currentCenter = useMemo<[number, number]>(() => {
    if (level === 4 && activeCity && activeCountry) {
      return cityMap.get(`${activeCity}||${activeCountry}`)?.center ?? globalCenter;
    }
    if (level === 3 && activeCountry) {
      return countryMap.get(activeCountry)?.center ?? globalCenter;
    }
    if (level === 2 && activeContinent) {
      return continentMap.get(activeContinent)?.center ?? globalCenter;
    }
    return globalCenter;
  }, [level, activeCity, activeCountry, activeContinent, cityMap, countryMap, continentMap, globalCenter]);

  const currentBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (level === 4 && activeCity && activeCountry) {
      return cityMap.get(`${activeCity}||${activeCountry}`)?.bounds ?? null;
    }
    return null;
  }, [level, activeCity, activeCountry, cityMap]);

  const breadcrumbItems = useMemo(() => {
    const items: { label: string; count?: number; action?: () => void }[] = [];
    items.push({
      label: "Globe",
      count: events.length,
      action: level === 1 ? undefined : () => onDrill({ level: "globe" }),
    });
    if (activeContinent) {
      items.push({
        label: activeContinent,
        count: filteredContinentCount.get(activeContinent),
        action: level === 2 ? undefined : () => onDrill({ level: "continent", continent: activeContinent }),
      });
    }
    if (activeCountry) {
      items.push({
        label: activeCountry,
        count: filteredCountryCount.get(activeCountry),
        action: level === 3 ? undefined : () => onDrill({ level: "country", country: activeCountry }),
      });
    }
    if (activeCity && activeCountry) {
      items.push({
        label: activeCity,
        count: filteredCityCount.get(`${activeCity}||${activeCountry}`),
        action: level === 4 ? undefined : () => onDrill({ level: "city", country: activeCountry, city: activeCity }),
      });
    }
    return items;
  }, [level, activeContinent, activeCountry, activeCity, events.length, filteredContinentCount, filteredCountryCount, filteredCityCount, onDrill]);

  const countriesForActiveContinent = activeContinent
    ? countryEntries.filter((c) => c.continent === activeContinent)
    : countryEntries;

  const citiesForActiveCountry = activeCountry
    ? cityEntries.filter((city) => city.country === activeCountry)
    : cityEntries;

  const cityEvents = events.filter((event) => {
    if (!activeCity || !activeCountry) return false;
    const canonical = normalizeCityName(event.location.city) ?? event.location.city;
    return canonical === activeCity && event.location.country === activeCountry;
  });

  if (events.length === 0) {
    return <p className={embedded ? "p-4 text-gray-500" : "mt-6 text-gray-500"}>No events to show yet.</p>;
  }

  return (
    <div className={embedded ? "h-full flex flex-col" : "mt-6 space-y-3"}>
      {!embedded && <BreadcrumbNav items={breadcrumbItems} />}
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm" style={{ height: embedded ? "100%" : height }}>
        <MapContainer
          center={currentCenter}
          zoom={LEVEL_ZOOM[level]}
          minZoom={1}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
          doubleClickZoom
          touchZoom
          keyboard={false}
          zoomControl={false}
        >
          <MapController center={currentCenter} zoom={LEVEL_ZOOM[level]} bounds={currentBounds} />
          <ZoomWatcher
            level={level}
            drill={drill}
            onDrill={onDrill}
            continentEntries={continentEntries}
            countryEntries={countryEntries}
            cityEntries={cityEntries}
            countryMap={countryMap}
          />
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />
          {level === 1 &&
            continentEntries.map((cont) => {
              const count = filteredContinentCount.get(cont.continent) ?? 0;
              if (count === 0) return null;
              return (
                <Marker
                  key={cont.continent}
                  position={cont.center}
                  icon={countIcon(count, freshContinents.has(cont.continent) ? "#3b82f6" : "#7c3aed", `${cont.continent}: ${count} event${count !== 1 ? "s" : ""}`, 64)}
                  eventHandlers={{ click: () => onDrill({ level: "continent", continent: cont.continent }) }}
                />
              );
            })}
          {level === 2 &&
            countriesForActiveContinent.map((country) => {
              const count = filteredCountryCount.get(country.country) ?? 0;
              if (count === 0) return null;
              return (
                <Marker
                  key={country.country}
                  position={country.center}
                  icon={countIcon(count, freshCountries.has(country.country) ? "#3b82f6" : "#6366f1", `${country.country}: ${count} event${count !== 1 ? "s" : ""}`)}
                  eventHandlers={{ click: () => onDrill({ level: "country", country: country.country }) }}
                />
              );
            })}
          {level === 3 &&
            citiesForActiveCountry.map((city) => {
              const cityKey = `${city.city}||${city.country}`;
              const count = filteredCityCount.get(cityKey) ?? 0;
              if (count === 0) return null;
              return (
                <Marker
                  key={`${city.city}-${city.country}`}
                  position={city.center}
                  icon={countIcon(count, freshCities.has(cityKey) ? "#3b82f6" : "#0ea5e9", `${city.city}: ${count} event${count !== 1 ? "s" : ""}`)}
                  eventHandlers={{ click: () => onDrill({ level: "city", country: city.country, city: city.city }) }}
                />
              );
            })}
          {level === 4 &&
            (() => {
              // Group events by location so each venue shows a single pill with event count
              const locationGroups = new Map<string, EventSummary[]>();
              for (const event of cityEvents) {
                const key = event.location.id;
                if (!locationGroups.has(key)) locationGroups.set(key, []);
                locationGroups.get(key)!.push(event);
              }
              return Array.from(locationGroups.entries()).map(([locId, eventsAtLoc]) => {
                const first = eventsAtLoc[0];
                const count = eventsAtLoc.length;
                const color = count === 1 ? DAY_HEX[getEventDay(first)] : "#6366f1";
                const title = count === 1
                  ? first.title
                  : `${first.location.name}: ${count} events`;
                return (
                  <Marker
                    key={locId}
                    position={[first.location.latitude, first.location.longitude]}
                    icon={countIcon(count, color, title, 52)}
                    eventHandlers={count === 1 ? { click: () => (window.location.href = `/events/${first.id}?from=map`) } : {}}
                  >
                    {count > 1 && (
                      <Popup>
                        <div className="text-sm space-y-1 min-w-[140px]">
                          <p className="font-semibold text-gray-700 mb-1">{first.location.name}</p>
                          {eventsAtLoc.map((e) => (
                            <a
                              key={e.id}
                              href={`/events/${e.id}?from=map`}
                              className="block text-indigo-600 hover:underline"
                            >
                              {e.title}
                            </a>
                          ))}
                        </div>
                      </Popup>
                    )}
                  </Marker>
                );
              });
            })()}
        </MapContainer>
      </div>
    </div>
  );
}

// ── Zoom snapping: zoom-out drills up; zoom-in drills into nearest entry ──────

interface ZoomWatcherProps {
  level: Level;
  drill: DrillState;
  onDrill: (d: DrillState) => void;
  continentEntries: ContinentEntry[];
  countryEntries: CountryEntry[];
  cityEntries: CityEntry[];
  countryMap: Map<string, { continent: string }>;
}

function ZoomWatcher({ level, drill, onDrill, continentEntries, countryEntries, cityEntries, countryMap }: ZoomWatcherProps) {
  // Keep a ref so the handler can see current props without re-registering
  const ref = useRef({ level, drill, onDrill, continentEntries, countryEntries, cityEntries, countryMap });
  useEffect(() => { ref.current = { level, drill, onDrill, continentEntries, countryEntries, cityEntries, countryMap }; });

  useMapEvent("zoomend", (e) => {
    const zoom = e.target.getZoom() as number;
    const { level: lv, drill: d, onDrill: od, continentEntries: ce, countryEntries: coe, cityEntries: cie, countryMap: cm } = ref.current;

    // ── Zoom-out: drill up ────────────────────────────────────────────
    if (lv === 4 && zoom < ZOOM_DOWN_THRESHOLD[4]) {
      if ("country" in d) od({ level: "country", country: d.country });
    } else if (lv === 3 && zoom < ZOOM_DOWN_THRESHOLD[3]) {
      const country = "country" in d ? d.country : null;
      const continent = country ? (cm.get(country)?.continent ?? null) : null;
      if (continent) od({ level: "continent", continent });
      else od({ level: "globe" });
    } else if (lv === 2 && zoom < ZOOM_DOWN_THRESHOLD[2]) {
      od({ level: "globe" });

    // ── Zoom-in: drill into nearest entry to map centre ───────────────
    } else if (lv === 1 && zoom >= ZOOM_UP_THRESHOLD[1]) {
      const center = e.target.getCenter();
      const nearest = nearestEntry(ce, center);
      if (nearest) od({ level: "continent", continent: nearest.continent });
    } else if (lv === 2 && zoom >= ZOOM_UP_THRESHOLD[2]) {
      const center = e.target.getCenter();
      const continent = d.level === "continent" ? d.continent : null;
      const filtered = continent ? coe.filter((c) => c.continent === continent) : coe;
      const nearest = nearestEntry(filtered, center);
      if (nearest) od({ level: "country", country: nearest.country });
    } else if (lv === 3 && zoom >= ZOOM_UP_THRESHOLD[3]) {
      const center = e.target.getCenter();
      const country = "country" in d ? d.country : null;
      const filtered = country ? cie.filter((c) => c.country === country) : cie;
      const nearest = nearestEntry(filtered, center);
      if (nearest) od({ level: "city", country: nearest.country, city: nearest.city });
    }
  });

  return null;
}

// ── MapController: fly/fit when drill changes ────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the entry whose centre is closest to the given Leaflet LatLng. */
function nearestEntry<T extends { center: [number, number] }>(entries: T[], latlng: { lat: number; lng: number }): T | null {
  if (entries.length === 0) return null;
  return entries.reduce((best, e) => {
    const d = (e.center[0] - latlng.lat) ** 2 + (e.center[1] - latlng.lng) ** 2;
    const bd = (best.center[0] - latlng.lat) ** 2 + (best.center[1] - latlng.lng) ** 2;
    return d < bd ? e : best;
  });
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

"use client";

import { useMemo } from "react";
import type { EventSummary } from "@/types";
import { buildLocationHierarchy } from "@/lib/location-hierarchy";
import { getContinent } from "@/lib/location-hierarchy";
import { isEventFresh } from "@/lib/event-utils";
import { buildExternalMapLinks } from "@/lib/map-links";
import { EventCard } from "./event-card";
import { BreadcrumbNav } from "./breadcrumbs";
import type { DrillState } from "./events-content";

interface Props {
  events: EventSummary[];
  lastLogin: string | null;
  drill: DrillState;
  onDrill: (d: DrillState) => void;
}

function hasNewEvents(evts: EventSummary[], lastLogin: string | null) {
  return evts.some((e) => !e.isPast && isEventFresh(e, lastLogin));
}

export function EventsHierarchy({ events, lastLogin, drill, onDrill }: Props) {
  const hierarchy = useMemo(() => buildLocationHierarchy(events), [events]);

  if (events.length === 0) {
    return <p className="mt-6 text-gray-500">No upcoming events yet. Check back soon!</p>;
  }

  // ── Breadcrumbs with counts ──────────────────────────────────────
  const totalCount = events.length;
  const breadcrumbItems: { label: string; count?: number; action?: () => void }[] = [];

  breadcrumbItems.push({
    label: "Globe",
    count: totalCount,
    action: drill.level === "globe" ? undefined : () => onDrill({ level: "globe" }),
  });

  if (drill.level === "continent") {
    const continentEntry = hierarchy.find((c) => c.continent === drill.continent);
    breadcrumbItems.push({ label: drill.continent, count: continentEntry?.eventCount });
  } else if (drill.level === "country" || drill.level === "city" || drill.level === "venue") {
    const continent = getContinent(drill.country);
    const continentEntry = hierarchy.find((c) => c.continent === continent);
    breadcrumbItems.push({
      label: continent,
      count: continentEntry?.eventCount,
      action: () => onDrill({ level: "continent", continent }),
    });
  }

  if (drill.level === "country") {
    const continentEntry = hierarchy.find((c) => c.continent === getContinent(drill.country));
    const countryEntry = continentEntry?.countries.find((c) => c.country === drill.country);
    breadcrumbItems.push({ label: drill.country, count: countryEntry?.eventCount });
  } else if (drill.level === "city" || drill.level === "venue") {
    const continentEntry = hierarchy.find((c) => c.continent === getContinent(drill.country));
    const countryEntry = continentEntry?.countries.find((c) => c.country === drill.country);
    breadcrumbItems.push({
      label: drill.country,
      count: countryEntry?.eventCount,
      action: () => onDrill({ level: "country", country: drill.country }),
    });
  }

  if (drill.level === "city") {
    const continentEntry = hierarchy.find((c) => c.continent === getContinent(drill.country));
    const countryEntry = continentEntry?.countries.find((c) => c.country === drill.country);
    const cityEntry = countryEntry?.cities.find((ci) => ci.city === drill.city);
    breadcrumbItems.push({ label: drill.city, count: cityEntry?.eventCount });
  } else if (drill.level === "venue") {
    const continentEntry = hierarchy.find((c) => c.continent === getContinent(drill.country));
    const countryEntry = continentEntry?.countries.find((c) => c.country === drill.country);
    const cityEntry = countryEntry?.cities.find((ci) => ci.city === drill.city);
    breadcrumbItems.push({
      label: drill.city,
      count: cityEntry?.eventCount,
      action: () => onDrill({ level: "city", country: drill.country, city: drill.city }),
    });
  }

  if (drill.level === "venue") {
    breadcrumbItems.push({ label: drill.venue });
  }

  return (
    <div className="mt-6 space-y-4">
      <BreadcrumbNav items={breadcrumbItems} />

      {/* Globe level: show continent cards */}
      {drill.level === "globe" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hierarchy.map((continentGroup) => {
            const isNew = continentGroup.countries.some((co) =>
              co.cities.some((ci) => ci.venues.some((v) => hasNewEvents(v.events, lastLogin)))
            );
            return (
              <button
                key={continentGroup.continent}
                type="button"
                onClick={() => onDrill({ level: "continent", continent: continentGroup.continent })}
                className={`rounded-lg border p-5 text-left shadow-sm transition hover:shadow-md ${
                  isNew
                    ? "border-blue-200 bg-blue-50/40 hover:border-blue-300"
                    : "border-gray-200 bg-white hover:border-indigo-300"
                }`}
              >
                <h3 className="text-lg font-semibold">{continentGroup.continent}</h3>
                <p className={`mt-2 text-2xl font-bold ${isNew ? "text-blue-600" : "text-gray-900"}`}>
                  {continentGroup.eventCount}
                  {isNew && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />}
                </p>
                <p className="text-xs uppercase tracking-wide text-gray-400">events</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Continent level: show country cards */}
      {drill.level === "continent" && (() => {
        const continentGroup = hierarchy.find((c) => c.continent === drill.continent);
        if (!continentGroup) return <p className="text-gray-500">Continent not found.</p>;
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continentGroup.countries.map((country) => {
              const isNew = country.cities.some((ci) => ci.venues.some((v) => hasNewEvents(v.events, lastLogin)));
              return (
                <button
                  key={country.country}
                  type="button"
                  onClick={() => onDrill({ level: "country", country: country.country })}
                  className={`rounded-lg border p-5 text-left shadow-sm transition hover:shadow-md ${
                    isNew
                      ? "border-blue-200 bg-blue-50/40 hover:border-blue-300"
                      : "border-gray-200 bg-white hover:border-indigo-300"
                  }`}
                >
                  <h3 className="text-lg font-semibold">{country.country}</h3>
                  <p className={`mt-2 text-2xl font-bold ${isNew ? "text-blue-600" : "text-gray-900"}`}>
                    {country.eventCount}
                    {isNew && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-gray-400">events</p>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Country level: show city cards */}
      {drill.level === "country" && (() => {
        const continentGroup = hierarchy.find((c) => c.continent === getContinent(drill.country));
        const country = continentGroup?.countries.find((c) => c.country === drill.country);
        if (!country) return <p className="text-gray-500">Country not found.</p>;
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {country.cities.map((city) => {
              const isNew = city.venues.some((v) => hasNewEvents(v.events, lastLogin));
              return (
                <button
                  key={city.city}
                  type="button"
                  onClick={() => onDrill({ level: "city", country: drill.country, city: city.city })}
                  className={`rounded-lg border p-5 text-left shadow-sm transition hover:shadow-md ${
                    isNew
                      ? "border-blue-200 bg-blue-50/40 hover:border-blue-300"
                      : "border-gray-200 bg-white hover:border-indigo-300"
                  }`}
                >
                  <h3 className="text-lg font-semibold">{city.city}</h3>
                  <p className={`mt-2 text-2xl font-bold ${isNew ? "text-blue-600" : "text-gray-900"}`}>
                    {city.eventCount}
                    {isNew && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-gray-400">events</p>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* City level: show venue cards */}
      {drill.level === "city" && (() => {
        const continentGroup = hierarchy.find((c) => c.continent === getContinent(drill.country));
        const country = continentGroup?.countries.find((c) => c.country === drill.country);
        const city = country?.cities.find((ci) => ci.city === drill.city);
        if (!city) return <p className="text-gray-500">City not found.</p>;
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {city.venues.map((venue) => {
              const isNew = hasNewEvents(venue.events, lastLogin);
              return (
                <button
                  key={venue.venue}
                  type="button"
                  onClick={() => onDrill({ level: "venue", country: drill.country, city: drill.city, venue: venue.venue })}
                  className={`rounded-lg border p-5 text-left shadow-sm transition hover:shadow-md ${
                    isNew
                      ? "border-blue-200 bg-blue-50/40 hover:border-blue-300"
                      : "border-gray-200 bg-white hover:border-indigo-300"
                  }`}
                >
                  <h3 className="text-lg font-semibold">{venue.venue}</h3>
                  <p className={`mt-2 text-2xl font-bold ${isNew ? "text-blue-600" : "text-gray-900"}`}>
                    {venue.eventCount}
                    {isNew && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-gray-400">events</p>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Venue level: show event cards */}
      {drill.level === "venue" && (() => {
        const continentGroup = hierarchy.find((c) => c.continent === getContinent(drill.country));
        const country = continentGroup?.countries.find((c) => c.country === drill.country);
        const city = country?.cities.find((ci) => ci.city === drill.city);
        const venue = city?.venues.find((v) => v.venue === drill.venue);
        if (!venue) return <p className="text-gray-500">Venue not found.</p>;
        const location = venue.events[0]?.location;
        const mapLinks = location
          ? buildExternalMapLinks({ latitude: venue.latitude, longitude: venue.longitude, what3names: location.what3names })
          : [];
        return (
          <div className="space-y-6">
            {location && (
              <section className="rounded-lg border border-gray-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-gray-900">{location.name}</h2>
                <p className="text-sm text-gray-600">{location.city}, {location.country}</p>
                {location.what3names && (
                  <p className="mt-2 text-sm text-indigo-600">What3Names: {location.what3names}</p>
                )}
                {location.howToFind && (
                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-semibold">How to find us:</span> {location.howToFind}
                  </p>
                )}
                {mapLinks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    {mapLinks.map((link) => (
                      <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="rounded-full border border-gray-200 px-3 py-1 text-gray-600 hover:bg-gray-50">
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}
            <ul className="space-y-4">
              {venue.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  lastLogin={lastLogin}
                  from="list"
                />
              ))}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}

import { describe, it, expect } from "vitest";
import { buildLocationHierarchy } from "@/lib/location-hierarchy";
import type { EventSummary, Location } from "@/types";

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "loc-default",
    name: "Test Venue",
    city: "London",
    country: "United Kingdom",
    latitude: 51.5074,
    longitude: -0.1278,
    what3names: null,
    howToFind: null,
    ...overrides,
  } as Location;
}

function makeEvent(overrides: Omit<Partial<EventSummary>, "location"> & { id: string } & { location?: Partial<Location> & { name: string; city: string; country: string } }): EventSummary {
  const location = makeLocation(overrides.location);
  return {
    title: "Test Event",
    description: "desc",
    dateTime: "2026-03-01T10:00:00Z",
    endDateTime: "2026-03-01T12:00:00Z",
    attendeeCount: 0,
    roleCounts: { Base: 0, Flyer: 0, Hybrid: 0 },
    teacherCount: 0,
    dateAdded: "2026-01-01T00:00:00Z",
    lastUpdated: "2026-01-01T00:00:00Z",
    recurrence: null,
    nextOccurrence: null,
    ...overrides,
    location,
  } as EventSummary;
}

describe("buildLocationHierarchy", () => {
  it("returns empty array for no events", () => {
    expect(buildLocationHierarchy([])).toEqual([]);
  });

  it("groups a single event into one country, one city, one venue", () => {
    const events = [makeEvent({ id: "e1", location: { name: "Park", country: "UK", city: "London", latitude: 51.5, longitude: -0.1 } })];
    const result = buildLocationHierarchy(events);

    expect(result).toHaveLength(1);
    expect(result[0].country).toBe("UK");
    expect(result[0].eventCount).toBe(1);
    expect(result[0].cities).toHaveLength(1);
    expect(result[0].cities[0].city).toBe("London");
    expect(result[0].cities[0].eventCount).toBe(1);
    expect(result[0].cities[0].venues).toHaveLength(1);
    expect(result[0].cities[0].venues[0].venue).toBe("Park");
    expect(result[0].cities[0].venues[0].eventCount).toBe(1);
    expect(result[0].cities[0].venues[0].events).toHaveLength(1);
  });

  it("groups multiple events at the same venue", () => {
    const events = [
      makeEvent({ id: "e1", location: { name: "Park", country: "UK", city: "London", latitude: 51.5, longitude: -0.1 } }),
      makeEvent({ id: "e2", location: { name: "Park", country: "UK", city: "London", latitude: 51.5, longitude: -0.1 } }),
    ];
    const result = buildLocationHierarchy(events);

    expect(result).toHaveLength(1);
    expect(result[0].eventCount).toBe(2);
    expect(result[0].cities[0].venues).toHaveLength(1);
    expect(result[0].cities[0].venues[0].eventCount).toBe(2);
    expect(result[0].cities[0].venues[0].events).toHaveLength(2);
  });

  it("groups multiple venues in one city", () => {
    const events = [
      makeEvent({ id: "e1", location: { name: "Park A", country: "UK", city: "London", latitude: 51.5, longitude: -0.1 } }),
      makeEvent({ id: "e2", location: { name: "Park B", country: "UK", city: "London", latitude: 51.51, longitude: -0.12 } }),
    ];
    const result = buildLocationHierarchy(events);

    expect(result).toHaveLength(1);
    expect(result[0].cities).toHaveLength(1);
    expect(result[0].cities[0].venues).toHaveLength(2);
    expect(result[0].cities[0].eventCount).toBe(2);
  });

  it("groups multiple cities under one country", () => {
    const events = [
      makeEvent({ id: "e1", location: { name: "V1", country: "UK", city: "London", latitude: 51.5, longitude: -0.1 } }),
      makeEvent({ id: "e2", location: { name: "V2", country: "UK", city: "Manchester", latitude: 53.48, longitude: -2.24 } }),
    ];
    const result = buildLocationHierarchy(events);

    expect(result).toHaveLength(1);
    expect(result[0].cities).toHaveLength(2);
    expect(result[0].eventCount).toBe(2);
  });

  it("groups multiple countries", () => {
    const events = [
      makeEvent({ id: "e1", location: { name: "V1", country: "UK", city: "London", latitude: 51.5, longitude: -0.1 } }),
      makeEvent({ id: "e2", location: { name: "V2", country: "France", city: "Paris", latitude: 48.86, longitude: 2.35 } }),
    ];
    const result = buildLocationHierarchy(events);

    expect(result).toHaveLength(2);
  });

  it("sorts alphabetically at all levels", () => {
    const events = [
      makeEvent({ id: "e1", location: { name: "Zulu Gym", country: "UK", city: "Manchester", latitude: 53.48, longitude: -2.24 } }),
      makeEvent({ id: "e2", location: { name: "Alpha Centre", country: "France", city: "Paris", latitude: 48.86, longitude: 2.35 } }),
      makeEvent({ id: "e3", location: { name: "Beta Park", country: "UK", city: "London", latitude: 51.5, longitude: -0.1 } }),
      makeEvent({ id: "e4", location: { name: "Alpha Park", country: "UK", city: "London", latitude: 51.51, longitude: -0.12 } }),
    ];
    const result = buildLocationHierarchy(events);

    // Countries sorted
    expect(result[0].country).toBe("France");
    expect(result[1].country).toBe("UK");

    // Cities within UK sorted
    const uk = result[1];
    expect(uk.cities[0].city).toBe("London");
    expect(uk.cities[1].city).toBe("Manchester");

    // Venues within London sorted
    const london = uk.cities[0];
    expect(london.venues[0].venue).toBe("Alpha Park");
    expect(london.venues[1].venue).toBe("Beta Park");
  });

  it("sorts events within a venue by dateTime", () => {
    const events = [
      makeEvent({ id: "e2", dateTime: "2026-03-02T10:00:00Z", location: { name: "Park", country: "UK", city: "London", latitude: 51.5, longitude: -0.1 } }),
      makeEvent({ id: "e1", dateTime: "2026-03-01T10:00:00Z", location: { name: "Park", country: "UK", city: "London", latitude: 51.5, longitude: -0.1 } }),
    ];
    const result = buildLocationHierarchy(events);
    const venueEvents = result[0].cities[0].venues[0].events;

    expect(venueEvents[0].id).toBe("e1");
    expect(venueEvents[1].id).toBe("e2");
  });
});

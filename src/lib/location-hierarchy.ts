import type { EventSummary, LocationHierarchy, CountryGroup, CityGroup, VenueGroup } from "@/types";

/**
 * Group a flat array of events into a Country → City → Venue hierarchy.
 * Sorted alphabetically at every level.
 */
export function buildLocationHierarchy(events: EventSummary[]): LocationHierarchy {
  const countryMap = new Map<string, Map<string, Map<string, EventSummary[]>>>();

  for (const event of events) {
    let cityMap = countryMap.get(event.country);
    if (!cityMap) {
      cityMap = new Map();
      countryMap.set(event.country, cityMap);
    }

    let venueMap = cityMap.get(event.city);
    if (!venueMap) {
      venueMap = new Map();
      cityMap.set(event.city, venueMap);
    }

    let venueEvents = venueMap.get(event.location);
    if (!venueEvents) {
      venueEvents = [];
      venueMap.set(event.location, venueEvents);
    }

    venueEvents.push(event);
  }

  const countries: CountryGroup[] = [];

  for (const [country, cityMap] of countryMap) {
    const cities: CityGroup[] = [];

    for (const [city, venueMap] of cityMap) {
      const venues: VenueGroup[] = [];

      for (const [venue, venueEvents] of venueMap) {
        venues.push({
          venue,
          events: venueEvents.sort((a, b) => a.dateTime.localeCompare(b.dateTime)),
          eventCount: venueEvents.length,
        });
      }

      venues.sort((a, b) => a.venue.localeCompare(b.venue));
      cities.push({
        city,
        venues,
        eventCount: venues.reduce((sum, v) => sum + v.eventCount, 0),
      });
    }

    cities.sort((a, b) => a.city.localeCompare(b.city));
    countries.push({
      country,
      cities,
      eventCount: cities.reduce((sum, c) => sum + c.eventCount, 0),
    });
  }

  countries.sort((a, b) => a.country.localeCompare(b.country));
  return countries;
}

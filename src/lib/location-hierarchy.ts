import type { EventSummary, LocationHierarchy, CountryGroup, CityGroup, VenueGroup } from "@/types";

/**
 * Group a flat array of events into a Country → City → Venue hierarchy.
 * Sorted alphabetically at every level.
 * Each group includes lat/lng computed as the average of its children.
 */
export function buildLocationHierarchy(events: EventSummary[]): LocationHierarchy {
  const countryMap = new Map<string, Map<string, Map<string, EventSummary[]>>>();

  for (const event of events) {
    const country = event.location.country;
    const city = event.location.city;
    const venue = event.location.name;

    let cityMap = countryMap.get(country);
    if (!cityMap) {
      cityMap = new Map();
      countryMap.set(country, cityMap);
    }

    let venueMap = cityMap.get(city);
    if (!venueMap) {
      venueMap = new Map();
      cityMap.set(city, venueMap);
    }

    let venueEvents = venueMap.get(venue);
    if (!venueEvents) {
      venueEvents = [];
      venueMap.set(venue, venueEvents);
    }

    venueEvents.push(event);
  }

  const countries: CountryGroup[] = [];

  for (const [country, cityMap] of countryMap) {
    const cities: CityGroup[] = [];

    for (const [city, venueMap] of cityMap) {
      const venues: VenueGroup[] = [];

      for (const [venue, venueEvents] of venueMap) {
        // Venue lat/lng from the first event's location (all events at same venue share coords)
        const lat = venueEvents[0].location.latitude;
        const lng = venueEvents[0].location.longitude;
        venues.push({
          venue,
          latitude: lat,
          longitude: lng,
          events: venueEvents.sort((a, b) => a.dateTime.localeCompare(b.dateTime)),
          eventCount: venueEvents.length,
        });
      }

      venues.sort((a, b) => a.venue.localeCompare(b.venue));
      // City lat/lng: average of its venue coordinates
      const cityLat = venues.reduce((sum, v) => sum + v.latitude, 0) / venues.length;
      const cityLng = venues.reduce((sum, v) => sum + v.longitude, 0) / venues.length;
      cities.push({
        city,
        latitude: cityLat,
        longitude: cityLng,
        venues,
        eventCount: venues.reduce((sum, v) => sum + v.eventCount, 0),
      });
    }

    cities.sort((a, b) => a.city.localeCompare(b.city));
    // Country lat/lng: average of its city coordinates
    const countryLat = cities.reduce((sum, c) => sum + c.latitude, 0) / cities.length;
    const countryLng = cities.reduce((sum, c) => sum + c.longitude, 0) / cities.length;
    countries.push({
      country,
      latitude: countryLat,
      longitude: countryLng,
      cities,
      eventCount: cities.reduce((sum, c) => sum + c.eventCount, 0),
    });
  }

  countries.sort((a, b) => a.country.localeCompare(b.country));
  return countries;
}

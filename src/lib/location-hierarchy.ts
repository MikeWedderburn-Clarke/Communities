import type { EventSummary, LocationHierarchy, ContinentGroup, CountryGroup, CityGroup, VenueGroup } from "@/types";
import { normalizeCityName } from "@/lib/city-utils";
import { dayOrder, getEventDay } from "@/lib/day-utils";

// ── Country → Continent mapping ──────────────────────────────────────────────
// Unknown countries fall back to "Other".
const COUNTRY_CONTINENT: Record<string, string> = {
  // Europe
  "Albania": "Europe", "Andorra": "Europe", "Austria": "Europe",
  "Belarus": "Europe", "Belgium": "Europe", "Bosnia and Herzegovina": "Europe",
  "Bulgaria": "Europe", "Croatia": "Europe", "Cyprus": "Europe",
  "Czech Republic": "Europe", "Denmark": "Europe", "Estonia": "Europe",
  "Finland": "Europe", "France": "Europe", "Germany": "Europe",
  "Greece": "Europe", "Hungary": "Europe", "Iceland": "Europe",
  "Ireland": "Europe", "Italy": "Europe", "Kosovo": "Europe",
  "Latvia": "Europe", "Liechtenstein": "Europe", "Lithuania": "Europe",
  "Luxembourg": "Europe", "Malta": "Europe", "Moldova": "Europe",
  "Monaco": "Europe", "Montenegro": "Europe", "Netherlands": "Europe",
  "North Macedonia": "Europe", "Norway": "Europe", "Poland": "Europe",
  "Portugal": "Europe", "Romania": "Europe", "Russia": "Europe",
  "San Marino": "Europe", "Serbia": "Europe", "Slovakia": "Europe",
  "Slovenia": "Europe", "Spain": "Europe", "Sweden": "Europe",
  "Switzerland": "Europe", "Ukraine": "Europe", "United Kingdom": "Europe",
  "England": "Europe", "Scotland": "Europe", "Wales": "Europe",
  "Northern Ireland": "Europe",
  // North America
  "Canada": "North America", "Costa Rica": "North America",
  "Cuba": "North America", "Dominican Republic": "North America",
  "El Salvador": "North America", "Guatemala": "North America",
  "Haiti": "North America", "Honduras": "North America",
  "Jamaica": "North America", "Mexico": "North America",
  "Nicaragua": "North America", "Panama": "North America",
  "Puerto Rico": "North America", "United States": "North America",
  // South America
  "Argentina": "South America", "Bolivia": "South America",
  "Brazil": "South America", "Chile": "South America",
  "Colombia": "South America", "Ecuador": "South America",
  "Guyana": "South America", "Paraguay": "South America",
  "Peru": "South America", "Suriname": "South America",
  "Uruguay": "South America", "Venezuela": "South America",
  // Oceania
  "Australia": "Oceania", "Fiji": "Oceania", "New Zealand": "Oceania",
  "Papua New Guinea": "Oceania", "Samoa": "Oceania", "Tonga": "Oceania",
  "Vanuatu": "Oceania",
  // Asia
  "Afghanistan": "Asia", "Armenia": "Asia", "Azerbaijan": "Asia",
  "Bahrain": "Asia", "Bangladesh": "Asia", "Bhutan": "Asia",
  "Brunei": "Asia", "Cambodia": "Asia", "China": "Asia",
  "Georgia": "Asia", "Hong Kong": "Asia", "India": "Asia",
  "Indonesia": "Asia", "Iran": "Asia", "Iraq": "Asia",
  "Israel": "Asia", "Japan": "Asia", "Jordan": "Asia",
  "Kazakhstan": "Asia", "Kuwait": "Asia", "Kyrgyzstan": "Asia",
  "Laos": "Asia", "Lebanon": "Asia", "Macau": "Asia",
  "Malaysia": "Asia", "Maldives": "Asia", "Mongolia": "Asia",
  "Myanmar": "Asia", "Nepal": "Asia", "North Korea": "Asia",
  "Oman": "Asia", "Pakistan": "Asia", "Palestine": "Asia",
  "Philippines": "Asia", "Qatar": "Asia", "Saudi Arabia": "Asia",
  "Singapore": "Asia", "South Korea": "Asia", "Sri Lanka": "Asia",
  "Syria": "Asia", "Taiwan": "Asia", "Tajikistan": "Asia",
  "Thailand": "Asia", "Timor-Leste": "Asia", "Turkey": "Asia",
  "Turkmenistan": "Asia", "United Arab Emirates": "Asia",
  "Uzbekistan": "Asia", "Vietnam": "Asia", "Yemen": "Asia",
  // Africa
  "Algeria": "Africa", "Angola": "Africa", "Benin": "Africa",
  "Botswana": "Africa", "Burkina Faso": "Africa", "Burundi": "Africa",
  "Cameroon": "Africa", "Cape Verde": "Africa", "Central African Republic": "Africa",
  "Chad": "Africa", "Comoros": "Africa", "Côte d'Ivoire": "Africa",
  "Democratic Republic of Congo": "Africa", "Djibouti": "Africa",
  "Egypt": "Africa", "Equatorial Guinea": "Africa", "Eritrea": "Africa",
  "Eswatini": "Africa", "Ethiopia": "Africa", "Gabon": "Africa",
  "Gambia": "Africa", "Ghana": "Africa", "Guinea": "Africa",
  "Guinea-Bissau": "Africa", "Kenya": "Africa", "Lesotho": "Africa",
  "Liberia": "Africa", "Libya": "Africa", "Madagascar": "Africa",
  "Malawi": "Africa", "Mali": "Africa", "Mauritania": "Africa",
  "Mauritius": "Africa", "Morocco": "Africa", "Mozambique": "Africa",
  "Namibia": "Africa", "Niger": "Africa", "Nigeria": "Africa",
  "Republic of Congo": "Africa", "Rwanda": "Africa",
  "São Tomé and Príncipe": "Africa", "Senegal": "Africa", "Seychelles": "Africa",
  "Sierra Leone": "Africa", "Somalia": "Africa", "South Africa": "Africa",
  "South Sudan": "Africa", "Sudan": "Africa", "Tanzania": "Africa",
  "Togo": "Africa", "Tunisia": "Africa", "Uganda": "Africa",
  "Zambia": "Africa", "Zimbabwe": "Africa",
};

/** Returns the continent name for a given country, defaulting to "Other". */
export function getContinent(country: string): string {
  return COUNTRY_CONTINENT[country] ?? "Other";
}

/**
 * Group a flat array of events into a Continent → Country → City → Venue hierarchy.
 * Sorted alphabetically at every level.
 * Each group includes lat/lng computed as the average of its children.
 */
export function buildLocationHierarchy(events: EventSummary[]): LocationHierarchy {
  // continent → country → city → venue → events
  const continentMap = new Map<string, Map<string, Map<string, Map<string, EventSummary[]>>>>();

  for (const event of events) {
    const continent = getContinent(event.location.country);
    const country = event.location.country;
    const city = normalizeCityName(event.location.city) ?? event.location.city;
    const venue = event.location.name;

    let countryMap = continentMap.get(continent);
    if (!countryMap) {
      countryMap = new Map();
      continentMap.set(continent, countryMap);
    }

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

  const continents: ContinentGroup[] = [];

  for (const [continent, countryMap] of continentMap) {
    const countries: CountryGroup[] = [];

    for (const [country, cityMap] of countryMap) {
      const cities: CityGroup[] = [];

      for (const [city, venueMap] of cityMap) {
        const venues: VenueGroup[] = [];

        for (const [venue, venueEvents] of venueMap) {
          const lat = venueEvents[0].location.latitude;
          const lng = venueEvents[0].location.longitude;
          venues.push({
            venue,
            latitude: lat,
            longitude: lng,
            events: venueEvents.sort((a, b) => {
              const dayDiff = dayOrder(getEventDay(a)) - dayOrder(getEventDay(b));
              if (dayDiff !== 0) return dayDiff;
              return getPrimaryDate(a).localeCompare(getPrimaryDate(b));
            }),
            eventCount: venueEvents.length,
          });
        }

        venues.sort((a, b) => a.venue.localeCompare(b.venue));
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
    const continentLat = countries.reduce((sum, c) => sum + c.latitude, 0) / countries.length;
    const continentLng = countries.reduce((sum, c) => sum + c.longitude, 0) / countries.length;
    continents.push({
      continent,
      latitude: continentLat,
      longitude: continentLng,
      countries,
      eventCount: countries.reduce((sum, c) => sum + c.eventCount, 0),
    });
  }

  continents.sort((a, b) => a.continent.localeCompare(b.continent));
  return continents;
}

function getPrimaryDate(event: EventSummary): string {
  return event.nextOccurrence?.dateTime ?? event.dateTime;
}

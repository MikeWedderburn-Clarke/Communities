/** Known city coordinates for the map view. Expand as more cities are seeded. */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  London: { lat: 51.5074, lng: -0.1278 },
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Bristol: { lat: 51.4545, lng: -2.5879 },
  Edinburgh: { lat: 55.9533, lng: -3.1883 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Lisbon: { lat: 38.7223, lng: -9.1393 },
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  "New York": { lat: 40.7128, lng: -74.006 },
  "Los Angeles": { lat: 34.0522, lng: -118.2437 },
  Sydney: { lat: -33.8688, lng: 151.2093 },
  Tokyo: { lat: 35.6762, lng: 139.6503 },
};

/** Known country centers for zooming. */
export const COUNTRY_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  "United Kingdom": { center: [-2.0, 54.0], zoom: 6 },
  France: { center: [2.0, 46.5], zoom: 5 },
  Germany: { center: [10.5, 51.0], zoom: 5 },
  Netherlands: { center: [5.3, 52.2], zoom: 7 },
  Spain: { center: [-3.7, 40.0], zoom: 5 },
  Portugal: { center: [-8.0, 39.5], zoom: 6 },
  "United States": { center: [-98.0, 39.0], zoom: 3 },
  Australia: { center: [134.0, -25.0], zoom: 3 },
  Japan: { center: [138.0, 36.0], zoom: 5 },
};

const CITY_ALIASES: Record<string, string> = {
  "greater london": "London",
  "city of london": "London",
  "london (greater)": "London",
  "nyc": "New York",
  "new york city": "New York",
  "new york, ny": "New York",
  "sf": "San Francisco",
  "san fran": "San Francisco",
};

export function normalizeCityName(city?: string | null): string | null {
  if (!city) return null;
  const trimmed = city.trim();
  if (!trimmed) return null;
  const canonical = CITY_ALIASES[trimmed.toLowerCase()];
  return canonical ?? trimmed;
}

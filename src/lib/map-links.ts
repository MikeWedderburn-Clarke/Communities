export interface ExternalMapLink {
  label: string;
  url: string;
}

export function buildExternalMapLinks({
  latitude,
  longitude,
  what3names,
}: {
  latitude: number;
  longitude: number;
  what3names?: string | null;
}): ExternalMapLink[] {
  const coords = `${latitude},${longitude}`;
  const links: ExternalMapLink[] = [
    {
      label: "Google Maps",
      url: `https://maps.google.com/?q=${encodeURIComponent(coords)}`,
    },
    {
      label: "Apple Maps",
      url: `https://maps.apple.com/?q=${encodeURIComponent(coords)}`,
    },
    {
      label: "OpenStreetMap",
      url: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`,
    },
  ];

  if (what3names && what3names.trim()) {
    const normalized = what3names.trim().replace(/\s+/g, ".").replace(/^\.|\.$/, "").toLowerCase();
    if (normalized) {
      links.push({
        label: "What3Names",
        url: `https://what3words.com/${encodeURIComponent(normalized)}`,
      });
    }
  }

  return links;
}

# Events Map View

The events page includes an interactive map built with **Leaflet** (via [react-leaflet](https://react-leaflet.js.org/)), allowing users to explore events geographically at multiple zoom levels.

**Implementation file:** `src/app/events/leaflet-map.tsx`

## Packages

| Package | Purpose |
|---|---|
| `leaflet` | Core map engine |
| `react-leaflet` | React bindings (`MapContainer`, `TileLayer`, `Marker`, `Popup`, etc.) |
| `react-leaflet-cluster` | Marker clustering (imported but level-based drill-down is used instead at higher zoom levels) |

## Drill-down navigation

The map uses a four-level drill-down hierarchy driven by a shared `drill` state:

| Level | View | Markers shown |
|---|---|---|
| 1 — Globe | World overview | One bubble per continent |
| 2 — Continent | Selected continent | One bubble per country |
| 3 — Country | Selected country | One bubble per city |
| 4 — City | Selected city | One pill/marker per venue or event |

Clicking a bubble at any level drills into the next level and animates the camera to fit the new selection.

## Zoom-driven behaviour (`ZoomWatcher`)

A `ZoomWatcher` component listens to Leaflet's `zoomend` event and automatically adjusts the drill level:

- **Zoom out past a threshold** → drill up one level.
- **Zoom in past a threshold** → drill down into the nearest continent/country/city relative to the current map centre.

The thresholds are defined as constants:

```ts
// Drill up if zoom drops below these values
const ZOOM_DOWN_THRESHOLD: Record<2 | 3 | 4, number> = { 2: 2.5, 3: 4.5, 4: 8 };

// Drill down if zoom exceeds these values
const ZOOM_UP_THRESHOLD: Record<1 | 2 | 3, number> = { 1: 3, 2: 5, 3: 9 };
```

## Custom bubble markers

Markers are rendered using `L.divIcon` rather than default Leaflet pins. Each marker is an HTML circle (`countIcon`) sized and coloured to reflect:

- The current drill level (continent / country / city).
- Whether any child events carry a "fresh" badge (new or recently updated).

The circle displays the event count for that geography.

## Tile source

The basemap uses **CARTO light_all** raster tiles:

```
https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
```

Attribution: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, © [CARTO](https://carto.com/attributions).

## City-level behaviour (Level 4)

At the deepest level the map groups events by **location/venue ID**:

- **Single event at a venue** — clicking the marker navigates directly to the event detail page.
- **Multiple events at a venue** — clicking opens a Leaflet `Popup` listing all events at that venue, each as a clickable link.

## Centroid and bounds calculation

Before rendering, the component derives aggregated geometry from `allEvents`:

1. **City centroids** — average lat/lng of all event locations in a city; bounding box used to `fitBounds` when drilling in.
2. **Country centroids** — average of all city points within the country.
3. **Continent centroids** — average of all country points within the continent.

A separate pass over the filtered `events` array builds the counts actually displayed in the bubbles (supporting `countMode: "events"` or `"instances"` for recurrence expansion within a date range).

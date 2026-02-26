"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import type { EventSummary } from "@/types";

import "leaflet/dist/leaflet.css";

// Fix default marker icons in bundlers (leaflet assets aren't auto-resolved)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/** Venue marker: green circle with event count. */
function venueIcon(eventCount: number) {
  return L.divIcon({
    html: `<div style="
      background: #059669;
      color: white;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${eventCount}</div>`,
    className: "",
    iconSize: L.point(32, 32),
    iconAnchor: L.point(16, 16),
    popupAnchor: L.point(0, -18),
  });
}

interface Props {
  events: EventSummary[];
}

interface VenueMarkerData {
  locationId: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  events: EventSummary[];
}

export function LeafletMap({ events }: Props) {
  const venues = useMemo(() => {
    const map = new Map<string, VenueMarkerData>();
    for (const event of events) {
      const loc = event.location;
      let entry = map.get(loc.id);
      if (!entry) {
        entry = {
          locationId: loc.id,
          name: loc.name,
          city: loc.city,
          country: loc.country,
          lat: loc.latitude,
          lng: loc.longitude,
          events: [],
        };
        map.set(loc.id, entry);
      }
      entry.events.push(event);
    }
    return Array.from(map.values());
  }, [events]);

  const defaultCenter: [number, number] =
    venues.length > 0
      ? [
          venues.reduce((s, v) => s + v.lat, 0) / venues.length,
          venues.reduce((s, v) => s + v.lng, 0) / venues.length,
        ]
      : [20, 0];
  const defaultZoom = venues.length > 0 ? 11 : 2;

  return (
    <div className="mt-6">
      <p className="text-sm text-gray-500">
        Click a marker to see events at that venue.
      </p>

      <div
        className="mt-3 overflow-hidden rounded-lg border border-gray-200 shadow-sm"
        style={{ height: "500px" }}
      >
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={60}
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
            zoomToBoundsOnClick
            iconCreateFunction={(cluster: { getChildCount: () => number }) => {
              const count = cluster.getChildCount();
              const size = count >= 50 ? 50 : count >= 10 ? 42 : 36;
              return L.divIcon({
                html: `<div style="background:#6366f1;color:#fff;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${count}</div>`,
                className: "",
                iconSize: L.point(size, size),
                iconAnchor: L.point(size / 2, size / 2),
              });
            }}
          >
            {venues.map((venue) => (
              <Marker
                key={venue.locationId}
                position={[venue.lat, venue.lng]}
                icon={venueIcon(venue.events.length)}
              >
                <Popup minWidth={240} maxWidth={340}>
                  <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                    <strong style={{ fontSize: "14px" }}>{venue.name}</strong>
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "12px",
                        marginTop: "2px",
                      }}
                    >
                      {venue.city}, {venue.country}
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {venue.events.map((event) => (
                        <a
                          key={event.id}
                          href={`/events/${event.id}`}
                          style={{
                            display: "block",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            background: "#f3f4f6",
                            textDecoration: "none",
                            color: "#1f2937",
                            fontSize: "13px",
                            lineHeight: "1.3",
                          }}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.background = "#e0e7ff")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.background = "#f3f4f6")
                          }
                        >
                          <div style={{ fontWeight: 600 }}>{event.title}</div>
                          <div
                            style={{
                              color: "#6b7280",
                              fontSize: "12px",
                              marginTop: "2px",
                            }}
                          >
                            {formatDateTime(event.dateTime)} ·{" "}
                            {event.attendeeCount} going
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

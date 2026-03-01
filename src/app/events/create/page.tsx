"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LEVELS, CURRENCIES, type Location, type SkillLevel } from "@/types";

/* ── Nominatim geocoding types ────────────────────────────────── */
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    amenity?: string;
    leisure?: string;
    building?: string;
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

export default function CreateEventPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const tomorrowIso = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  // Location state
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creatingLocation, setCreatingLocation] = useState(false);

  // Geocoding state for "add new location"
  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<NominatimResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showGeoDropdown, setShowGeoDropdown] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocCity, setNewLocCity] = useState("");
  const [newLocCountry, setNewLocCountry] = useState("");
  const [newLocCoords, setNewLocCoords] = useState("");
  const [newLocWhat3, setNewLocWhat3] = useState("");
  const [newLocDirections, setNewLocDirections] = useState("");
  const geoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  type RecurrenceOption = "none" | "daily" | "weekly" | "monthly";
  const [eventDate, setEventDate] = useState(tomorrowIso);
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceOption>("none");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  // New event fields
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("All levels");
  const [prerequisites, setPrerequisites] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costCurrency, setCostCurrency] = useState("GBP");
  const [concessionAmount, setConcessionAmount] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const url = locationSearch
      ? `/api/locations?q=${encodeURIComponent(locationSearch)}`
      : "/api/locations";
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then(setLocations)
      .catch(() => {});
    return () => controller.abort();
  }, [locationSearch]);

  // Debounced Nominatim geocoding for "add new location"
  useEffect(() => {
    if (geoTimerRef.current) clearTimeout(geoTimerRef.current);
    if (geoQuery.length < 3) {
      setGeoResults([]);
      return;
    }
    geoTimerRef.current = setTimeout(() => {
      setGeoLoading(true);
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(geoQuery)}`,
        { headers: { "User-Agent": "AcroYogaCommunities/1.0" } },
      )
        .then((r) => r.json())
        .then((data: NominatimResult[]) => {
          setGeoResults(data);
          setShowGeoDropdown(data.length > 0);
        })
        .catch(() => setGeoResults([]))
        .finally(() => setGeoLoading(false));
    }, 400);
    return () => {
      if (geoTimerRef.current) clearTimeout(geoTimerRef.current);
    };
  }, [geoQuery]);

  function handleGeoSelect(result: NominatimResult) {
    const addr = result.address ?? {};
    const venueName =
      addr.amenity ?? addr.leisure ?? addr.building ?? result.display_name.split(",")[0] ?? "";
    const city = addr.city ?? addr.town ?? addr.village ?? "";
    const country = addr.country ?? "";

    setNewLocName(venueName);
    setNewLocCity(city);
    setNewLocCountry(country);
    setNewLocCoords(`${result.lat}, ${result.lon}`);
    setShowGeoDropdown(false);
    setGeoQuery(result.display_name);
  }

  async function handleCreateLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreatingLocation(true);
    setError(null);

    const normalizedWhat3 = newLocWhat3.trim().replace(/\s+/g, ".");
    const [rawLat, rawLng] = newLocCoords.split(",").map((s) => s.trim());
    const latitude = parseFloat(rawLat ?? "");
    const longitude = parseFloat(rawLng ?? "");
    if (
      isNaN(latitude) || isNaN(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      setError('Coordinates must be in "lat, lng" format, e.g. 51.5074, -0.1278');
      setCreatingLocation(false);
      return;
    }
    const body = {
      name: newLocName,
      city: newLocCity,
      country: newLocCountry,
      latitude,
      longitude,
      what3names: normalizedWhat3 === "" ? null : normalizedWhat3,
      howToFind: newLocDirections.trim() === "" ? null : newLocDirections.trim(),
    };

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create location");
        return;
      }
      const newLoc: Location = {
        id: data.locationId,
        name: body.name,
        city: body.city,
        country: body.country,
        latitude: body.latitude,
        longitude: body.longitude,
        what3names: body.what3names,
        howToFind: body.howToFind,
      };
      setSelectedLocation(newLoc);
      setShowNewLocation(false);
      setLocationSearch("");
      // Reset geo fields
      setGeoQuery("");
      setGeoResults([]);
      setNewLocName("");
      setNewLocCity("");
      setNewLocCountry("");
      setNewLocCoords("");
      setNewLocWhat3("");
      setNewLocDirections("");
    } catch {
      setError("Network error creating location");
    } finally {
      setCreatingLocation(false);
    }
  }

  function handlePrereqKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ta = e.currentTarget;
    const { selectionStart, selectionEnd, value } = ta;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const insert = "\n• ";
    const next = before + insert + after;
    setPrerequisites(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = selectionStart + insert.length;
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLocation) {
      setError("Please select a location");
      return;
    }
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const dateTime = `${form.get("date")}T${form.get("startTime")}:00Z`;
    const endDateTime = `${form.get("date")}T${form.get("endTime")}:00Z`;

    const recurrenceFrequency = (form.get("recurrenceFrequency") as string) ?? "none";
    const recurrenceEndRaw = (form.get("recurrenceEndDate") as string) ?? "";
    const recurrence =
      recurrenceFrequency !== "none"
        ? {
            frequency: recurrenceFrequency,
            endDate: recurrenceEndRaw ? `${recurrenceEndRaw}T23:59:59Z` : null,
          }
        : null;

    const body = {
      title: form.get("title"),
      description: form.get("description"),
      dateTime,
      endDateTime,
      locationId: selectedLocation.id,
      recurrence,
      skillLevel,
      prerequisites: prerequisites.trim() || null,
      costAmount: costAmount !== "" ? parseFloat(costAmount) : null,
      costCurrency: costAmount !== "" ? costCurrency : null,
      concessionAmount: concessionAmount !== "" ? parseFloat(concessionAmount) : null,
      maxAttendees: maxAttendees !== "" ? parseInt(maxAttendees, 10) : null,
    };

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          data.details?.map((d: { message: string }) => d.message).join(". ") ??
          data.error ??
          "Something went wrong";
        setError(msg);
        return;
      }

      setSuccess(data.message);
      if (data.status === "approved") {
        setTimeout(() => router.push(`/events/${data.eventId}`), 1500);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">Create Event</h1>
      <p className="mt-1 text-gray-600">
        Submit a new AcroYoga event. Admin-created events go live instantly;
        others are held for review.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Event title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={200}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="e.g. Sunday AcroYoga Jam"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            maxLength={5000}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="What's the event about? Level, what to bring, etc."
          />
        </div>

        {/* Skill level */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Skill level</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SKILL_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setSkillLevel(level)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  skillLevel === level
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Prerequisites */}
        <div>
          <label htmlFor="prerequisites" className="block text-sm font-medium text-gray-700">
            Prerequisites <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="prerequisites"
            rows={3}
            value={prerequisites}
            onFocus={() => { if (prerequisites === "") setPrerequisites("• "); }}
            onChange={(e) => setPrerequisites(e.target.value)}
            onKeyDown={handlePrereqKeyDown}
            maxLength={2000}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="• e.g. Comfortable in bird pose"
          />
          <p className="mt-1 text-xs text-gray-500">Press Enter to add a new bullet. Attendees must confirm they meet these before signing up.</p>
        </div>

        {/* Cost */}
        <div className="rounded-lg border border-gray-200 bg-white/60 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Cost <span className="font-normal text-gray-400">(optional — leave blank for free events)</span></p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="costAmount" className="block text-sm text-gray-600">Amount</label>
              <input
                id="costAmount"
                type="number"
                min="0"
                step="0.01"
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <label htmlFor="costCurrency" className="block text-sm text-gray-600">Currency</label>
              <select
                id="costCurrency"
                value={costCurrency}
                onChange={(e) => setCostCurrency(e.target.value)}
                disabled={costAmount === ""}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="concessionAmount" className="block text-sm text-gray-600">Concession amount <span className="text-gray-400">(optional)</span></label>
            <input
              id="concessionAmount"
              type="number"
              min="0"
              step="0.01"
              value={concessionAmount}
              onChange={(e) => setConcessionAmount(e.target.value)}
              disabled={costAmount === ""}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100"
              placeholder="e.g. 7"
            />
            <p className="mt-1 text-xs text-gray-500">Reduced rate for students, unwaged, etc.</p>
          </div>
        </div>

        {/* Max attendees */}
        <div>
          <label htmlFor="maxAttendees" className="block text-sm font-medium text-gray-700">
            Max attendees <span className="font-normal text-gray-400">(optional — leave blank for no limit)</span>
          </label>
          <input
            id="maxAttendees"
            type="number"
            min="1"
            step="1"
            value={maxAttendees}
            onChange={(e) => setMaxAttendees(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="e.g. 20"
          />
        </div>

        {/* Date + Times */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              value={eventDate}
              onChange={(e) => {
                const nextDate = e.target.value;
                setEventDate(nextDate);
                if (recurrenceEndDate && nextDate && recurrenceEndDate < nextDate) {
                  setRecurrenceEndDate(nextDate);
                }
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">
              Start time
            </label>
            <input
              id="startTime"
              name="startTime"
              type="time"
              required
              defaultValue="10:00"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">
              End time
            </label>
            <input
              id="endTime"
              name="endTime"
              type="time"
              required
              defaultValue="12:00"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white/60 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="recurrenceFrequency" className="block text-sm font-medium text-gray-700">
                Repeats
              </label>
              <select
                id="recurrenceFrequency"
                name="recurrenceFrequency"
                value={recurrenceMode}
                onChange={(e) => {
                  const next = e.target.value as RecurrenceOption;
                  setRecurrenceMode(next);
                  if (next === "none") {
                    setRecurrenceEndDate("");
                  } else if (!recurrenceEndDate) {
                    setRecurrenceEndDate(eventDate);
                  }
                }}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly (same date)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Choose how often this event should repeat.</p>
            </div>
            <div>
              <label htmlFor="recurrenceEndDate" className="block text-sm font-medium text-gray-700">
                Repeat until
              </label>
              <input
                id="recurrenceEndDate"
                name="recurrenceEndDate"
                type="date"
                min={eventDate}
                required={recurrenceMode !== "none"}
                disabled={recurrenceMode === "none"}
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">We&apos;ll stop listing repeats after this date.</p>
            </div>
          </div>
        </div>

        {/* Location picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Location</label>

          {selectedLocation ? (
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
              <div className="flex-1">
                <span className="font-medium">{selectedLocation.name}</span>
                <span className="ml-1 text-sm text-gray-500">
                  {selectedLocation.city}, {selectedLocation.country}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLocation(null)}
                className="text-sm text-indigo-600 hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative mt-1">
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => {
                  setLocationSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Search for a venue..."
              />
              {showDropdown && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        setSelectedLocation(loc);
                        setShowDropdown(false);
                        setLocationSearch("");
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                    >
                      <span className="font-medium">{loc.name}</span>
                      <span className="ml-1 text-gray-500">
                        {loc.city}, {loc.country}
                      </span>
                    </button>
                  ))}
                  {locations.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-400">No locations found</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewLocation(true);
                      setShowDropdown(false);
                    }}
                    className="block w-full border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    + Add new location
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* New location inline — submit button is hidden while this is open */}
        {showNewLocation && !selectedLocation && (
          <p className="text-sm text-gray-500 italic">Complete the new location form below, then continue.</p>
        )}

        <button
          type="submit"
          disabled={submitting || (showNewLocation && !selectedLocation)}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Event"}
        </button>
      </form>

      {/* New location form — separate form to avoid nesting */}
      {showNewLocation && !selectedLocation && (() => {
        const hasCoords = newLocCoords.trim() !== "";
        const googleMapsUrl = hasCoords
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(newLocCoords.trim())}`
          : null;
        const what3wordsUrl = hasCoords
          ? `https://what3words.com/search?search=${encodeURIComponent(newLocCoords.trim())}`
          : "https://what3words.com/";
        return (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-700">Add New Location</h3>

          {/* Geocoding search */}
          <div className="relative mt-3">
            <label htmlFor="geoSearch" className="block text-sm text-gray-600">
              Search for a place
            </label>
            <input
              id="geoSearch"
              type="text"
              value={geoQuery}
              onChange={(e) => {
                setGeoQuery(e.target.value);
                setShowGeoDropdown(true);
              }}
              className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="e.g. Regent's Park London"
            />
            {geoLoading && (
              <p className="mt-1 text-xs text-gray-400">Searching…</p>
            )}
            {showGeoDropdown && geoResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg">
                {geoResults.map((r) => (
                  <button
                    key={r.place_id}
                    type="button"
                    onClick={() => handleGeoSelect(r)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleCreateLocation} className="mt-3 space-y-3">
            <div>
              <label htmlFor="locName" className="block text-sm text-gray-600">Venue name</label>
              <input id="locName" name="locName" type="text" required value={newLocName} onChange={(e) => setNewLocName(e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder="e.g. Regent's Park" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="locCity" className="block text-sm text-gray-600">City</label>
                <input id="locCity" name="locCity" type="text" required value={newLocCity} onChange={(e) => setNewLocCity(e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder="e.g. London" />
              </div>
              <div>
                <label htmlFor="locCountry" className="block text-sm text-gray-600">Country</label>
                <input id="locCountry" name="locCountry" type="text" required value={newLocCountry} onChange={(e) => setNewLocCountry(e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder="e.g. United Kingdom" />
              </div>
            </div>
            <div>
              <label htmlFor="locCoords" className="block text-sm text-gray-600">Coordinates</label>
              <input id="locCoords" name="locCoords" type="text" required value={newLocCoords} onChange={(e) => setNewLocCoords(e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-sm" placeholder="51.5074, -0.1278" />
              <p className="mt-1 text-xs text-gray-500">Paste directly from Google Maps — right-click a pin and copy the coordinates.</p>
            </div>
            {googleMapsUrl && (
              <p className="text-xs text-indigo-600">
                <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  Preview this pin on Google Maps
                </a>
              </p>
            )}
            <div>
              <label htmlFor="locWhat3" className="block text-sm text-gray-600">What3Words (optional)</label>
              <input id="locWhat3" name="locWhat3" type="text" value={newLocWhat3} onChange={(e) => setNewLocWhat3(e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder="gently.snowy.magic" />
              <p className="mt-1 text-xs text-gray-500">
                Use dots between the three words. Need help?
                <a href={what3wordsUrl} target="_blank" rel="noreferrer" className="ml-1 text-indigo-600 hover:underline">
                  Open what3words in a new tab
                </a>
                .
              </p>
            </div>
            <div>
              <label htmlFor="locDirections" className="block text-sm text-gray-600">How to find us (optional)</label>
              <textarea id="locDirections" name="locDirections" rows={3} value={newLocDirections} onChange={(e) => setNewLocDirections(e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder="Landmarks, entrance instructions, etc." />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creatingLocation} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                {creatingLocation ? "Creating…" : "Create Location"}
              </button>
              <button type="button" onClick={() => { setShowNewLocation(false); setGeoQuery(""); setGeoResults([]); setNewLocName(""); setNewLocCity(""); setNewLocCountry(""); setNewLocCoords(""); setNewLocWhat3(""); setNewLocDirections(""); }} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </form>
          </div>
        );
      })()}
    </main>
  );
}

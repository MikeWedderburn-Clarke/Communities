"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ROLES, PROFILE_VISIBILITY_TIERS, type Role, type UserProfile, type ProfileVisibility } from "@/types";

interface Props {
  profile: UserProfile;
}

const VISIBILITY_LABELS: Record<ProfileVisibility, string> = {
  everyone: "Everyone",
  followers: "Followers",
  friends: "Friends",
};

const VISIBILITY_DESCRIPTIONS: Record<ProfileVisibility, string> = {
  everyone: "All registered users can see your social links",
  followers: "Only people who follow you can see your social links",
  friends: "Only people you mark as friends can see your social links",
};

export function ProfileForm({ profile }: Props) {
  const router = useRouter();
  const [defaultRole, setDefaultRole] = useState<Role | null>(
    profile.defaultRole,
  );
  const [defaultShowName, setDefaultShowName] = useState<boolean | null>(
    profile.defaultShowName,
  );
  const [facebookUrl, setFacebookUrl] = useState(profile.facebookUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(profile.instagramUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(profile.youtubeUrl ?? "");
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>(
    profile.profileVisibility ?? "everyone",
  );

  // Home city
  const [homeCity, setHomeCity] = useState(profile.homeCity ?? "");
  const [useCurrentLocation, setUseCurrentLocation] = useState(profile.useCurrentLocation);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Teacher request state
  const [requestingTeacher, setRequestingTeacher] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  /** Reverse geocode coords to city name via Nominatim. */
  const detectCity = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation not supported");
      return;
    }
    setGeoStatus("Detecting location…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
            { headers: { "User-Agent": "AcroYogaCommunities/1.0" } },
          );
          const data = await res.json();
          const city =
            data.address?.city ??
            data.address?.town ??
            data.address?.village ??
            "";
          if (city) {
            setHomeCity(city);
            setGeoStatus(`Detected: ${city}`);
          } else {
            setGeoStatus("Could not determine city from location");
          }
        } catch {
          setGeoStatus("Geocoding failed");
        }
      },
      (err) => {
        setGeoStatus(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied"
            : "Could not get location",
        );
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, []);

  // Auto-detect on load if "use current location" is enabled
  useEffect(() => {
    if (useCurrentLocation) {
      detectCity();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultRole,
          defaultShowName,
          facebookUrl: facebookUrl || null,
          instagramUrl: instagramUrl || null,
          websiteUrl: websiteUrl || null,
          youtubeUrl: youtubeUrl || null,
          profileVisibility,
          homeCity: homeCity || null,
          useCurrentLocation,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestTeacher() {
    setRequestingTeacher(true);
    setTeacherError(null);
    try {
      const res = await fetch("/api/teacher-request", { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        setTeacherError(data.error ?? "Failed to submit teacher request");
      }
    } catch {
      setTeacherError("Failed to submit teacher request");
    } finally {
      setRequestingTeacher(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {/* Section 1: RSVP Defaults */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          RSVP Defaults
        </h2>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-gray-700">
            Default role
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <label
                key={r}
                className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${
                  defaultRole === r
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="defaultRole"
                  value={r}
                  checked={defaultRole === r}
                  onChange={() => setDefaultRole(r)}
                  className="sr-only"
                />
                {r}
              </label>
            ))}
            <label
              className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${
                defaultRole === null
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="defaultRole"
                value=""
                checked={defaultRole === null}
                onChange={() => setDefaultRole(null)}
                className="sr-only"
              />
              No default
            </label>
          </div>
        </fieldset>

        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700">
            Show my name by default
          </p>
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={defaultShowName === true}
                onChange={(e) =>
                  setDefaultShowName(e.target.checked ? true : false)
                }
                className="rounded border-gray-300"
              />
              Show name
            </label>
            {defaultShowName === null && (
              <span className="text-xs text-gray-400">(not set)</span>
            )}
            {defaultShowName !== null && (
              <button
                type="button"
                onClick={() => setDefaultShowName(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Home City */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Home City
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Events will default to showing your home city first.
        </p>

        <div className="mt-4">
          <label htmlFor="homeCity" className="block text-sm font-medium text-gray-700">
            City
          </label>
          <input
            id="homeCity"
            type="text"
            value={homeCity}
            onChange={(e) => setHomeCity(e.target.value)}
            placeholder="e.g. London, New York, Bristol"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useCurrentLocation}
              onChange={(e) => {
                const checked = e.target.checked;
                setUseCurrentLocation(checked);
                if (checked) detectCity();
              }}
              className="rounded border-gray-300"
            />
            Use my current location
          </label>
          <p className="text-xs text-gray-400">
            When enabled, your home city updates automatically each time you visit your profile.
          </p>
          {geoStatus && (
            <p className="text-xs text-gray-500">{geoStatus}</p>
          )}
          {!useCurrentLocation && (
            <button
              type="button"
              onClick={detectCity}
              className="text-sm text-indigo-600 hover:underline"
            >
              Detect my city now
            </button>
          )}
        </div>
      </section>

      {/* Section 3: Social Links */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Social Links
        </h2>

        <div className="mt-4 space-y-4">
          <SocialLinkRow label="Facebook" placeholder="https://facebook.com/yourprofile" url={facebookUrl} onUrlChange={setFacebookUrl} />
          <SocialLinkRow label="Instagram" placeholder="https://instagram.com/yourhandle" url={instagramUrl} onUrlChange={setInstagramUrl} />
          <SocialLinkRow label="Website" placeholder="https://yourwebsite.com" url={websiteUrl} onUrlChange={setWebsiteUrl} />
          <SocialLinkRow label="YouTube" placeholder="https://youtube.com/@yourchannel" url={youtubeUrl} onUrlChange={setYoutubeUrl} />
        </div>
      </section>

      {/* Section 4: Profile Visibility */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Profile Visibility
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Control who can see your social links on your profile and in event attendance lists.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PROFILE_VISIBILITY_TIERS.map((tier) => (
            <label
              key={tier}
              className={`cursor-pointer rounded-full border px-3 py-1 text-sm capitalize transition ${
                profileVisibility === tier
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              title={VISIBILITY_DESCRIPTIONS[tier]}
            >
              <input
                type="radio"
                name="profileVisibility"
                value={tier}
                checked={profileVisibility === tier}
                onChange={() => setProfileVisibility(tier)}
                className="sr-only"
              />
              {VISIBILITY_LABELS[tier]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {VISIBILITY_DESCRIPTIONS[profileVisibility]}
        </p>
      </section>

      {/* Section 5: Teacher Status */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Teacher Status
        </h2>
        <div className="mt-3">
          {profile.isTeacherApproved ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              Approved teacher
            </span>
          ) : profile.teacherRequestedAt ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded px-3 py-2">
              Teacher request pending — awaiting admin approval
            </p>
          ) : (
            <div>
              <p className="text-sm text-gray-600">
                Approved teachers can mark themselves as teaching an event when they RSVP.
              </p>
              <button
                type="button"
                disabled={requestingTeacher}
                onClick={handleRequestTeacher}
                className="mt-2 rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {requestingTeacher ? "Requesting..." : "Request teacher status"}
              </button>
              {teacherError && (
                <p className="mt-1 text-sm text-red-600">{teacherError}</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Feedback messages */}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <p className="text-sm text-green-600">Profile updated!</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}

function SocialLinkRow({
  label,
  placeholder,
  url,
  onUrlChange,
}: {
  label: string;
  placeholder: string;
  url: string;
  onUrlChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        type="url"
        placeholder={placeholder}
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}

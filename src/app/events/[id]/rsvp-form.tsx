"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLES, type Role } from "@/types";
import { formatCost } from "@/lib/format-cost";

interface Props {
  eventId: string;
  currentRsvp: { role: Role; showName: boolean; isTeaching: boolean } | null;
  isTeacherApproved: boolean;
  defaultRole: Role | null;
  defaultShowName: boolean | null;
  prerequisites: string | null;
  costAmount: number | null;
  costCurrency: string | null;
  concessionAmount: number | null;
}

export function RsvpForm({ eventId, currentRsvp, isTeacherApproved, defaultRole, defaultShowName, prerequisites, costAmount, costCurrency, concessionAmount }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(currentRsvp?.role ?? defaultRole ?? "Base");
  const [showName, setShowName] = useState(currentRsvp?.showName ?? defaultShowName ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTeaching, setIsTeaching] = useState(currentRsvp?.isTeaching ?? false);
  const [metPrereqs, setMetPrereqs] = useState(currentRsvp !== null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (prerequisites && !metPrereqs) {
      setError("Please confirm you meet the prerequisites for this event.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, role, showName, isTeaching }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    router.refresh();
    setSubmitting(false);
  }

  async function handleCancel() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/rsvp", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    router.refresh();
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4">
      {/* Cost info — read-only reminder */}
      {costAmount !== null && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-medium">Cost:</span>{" "}
          {formatCost(costAmount, costCurrency)}
          {concessionAmount !== null && (
            <span className="text-gray-500"> · {formatCost(concessionAmount, costCurrency)} concession</span>
          )}
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-gray-700">
          Your role
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <label
              key={r}
              className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${
                role === r
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              {r}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showName}
          onChange={(e) => setShowName(e.target.checked)}
          className="rounded border-gray-300"
        />
        Show my name publicly
      </label>

      <p className="text-xs text-gray-400">
        These settings apply to this event only.{" "}
        <Link href="/profile" className="text-indigo-500 hover:underline">
          Change your defaults
        </Link>
        .
      </p>

      {isTeacherApproved ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isTeaching}
            onChange={(e) => setIsTeaching(e.target.checked)}
            className="rounded border-gray-300"
          />
          I&apos;m teaching this event
        </label>
      ) : (
        <p className="text-sm text-gray-500">
          Want to teach?{" "}
          <Link href="/profile" className="text-indigo-600 hover:underline">
            Request teacher status
          </Link>{" "}
          on your profile.
        </p>
      )}

      {/* Prerequisites confirmation — only shown when event has prerequisites */}
      {prerequisites && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={metPrereqs}
            onChange={(e) => setMetPrereqs(e.target.checked)}
            className="mt-0.5 rounded border-gray-300"
          />
          <span>I confirm I meet the prerequisites for this event</span>
        </label>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting
            ? "Saving..."
            : currentRsvp
              ? "Update RSVP"
              : "RSVP"}
        </button>

        {currentRsvp && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel RSVP
          </button>
        )}
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, type Role, type TicketType, type Booking } from "@/types";

interface Props {
  ticketTypes: TicketType[];
  existingBooking: Booking | null;
  groupId: string;
  eventId: string;
}

function formatPrice(amount: number, currency: string): string {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function capacityLabel(t: TicketType): string {
  if (t.capacity === null) return "";
  const remaining = t.capacity - t.bookedCount;
  if (remaining <= 0) return "Sold out";
  if (remaining <= 5) return `${remaining} left`;
  return "";
}

export function TicketSelector({ ticketTypes, existingBooking, groupId, eventId }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("Base");
  const [showName, setShowName] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const available = ticketTypes.filter((t) => t.isAvailable && !t.isSoldOut);
  const selected = ticketTypes.find((t) => t.id === selectedId) ?? null;

  // Payment status display helper
  function statusBadge(status: string) {
    const classes: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700",
      paid: "bg-green-100 text-green-700",
      concession_paid: "bg-green-100 text-green-700",
      comp: "bg-purple-100 text-purple-700",
      refunded: "bg-gray-100 text-gray-500",
    };
    const labels: Record<string, string> = {
      pending: "Awaiting payment",
      paid: "Paid",
      concession_paid: "Paid (concession)",
      comp: "Complimentary",
      refunded: "Refunded",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[status] ?? "bg-gray-100 text-gray-600"}`}>
        {labels[status] ?? status}
      </span>
    );
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketTypeId: selectedId, role, showName, isTeaching: false }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    router.refresh();
  }

  async function handleCancel(bookingId: string) {
    if (!confirm("Cancel your booking? This cannot be undone.")) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/bookings/${bookingId}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to cancel");
      setSubmitting(false);
      return;
    }

    setCancelled(true);
    router.refresh();
  }

  // If the user already has an active booking
  if (existingBooking && existingBooking.paymentStatus !== "refunded" && !cancelled) {
    return (
      <div className="space-y-3">
        <h2 className="font-semibold">Your booking</h2>
        <div className="rounded-lg border border-gray-200 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{existingBooking.ticketTypeName}</span>
            {statusBadge(existingBooking.paymentStatus)}
          </div>
          {existingBooking.paymentStatus === "pending" && (
            <p className="mt-1 text-gray-500 text-xs">
              Payment details will be sent to you by the organiser.
            </p>
          )}
        </div>
        <button
          onClick={() => handleCancel(existingBooking.id)}
          disabled={submitting}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          Cancel booking
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Book tickets</h2>

      {available.length === 0 ? (
        <p className="text-sm text-gray-500">All tickets for this event are sold out.</p>
      ) : (
        <form onSubmit={handleBook} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">Select a ticket</legend>
            {ticketTypes.map((t) => {
              const label = capacityLabel(t);
              const disabled = t.isSoldOut || !t.isAvailable;
              return (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    disabled
                      ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                      : selectedId === t.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="ticketType"
                    value={t.id}
                    disabled={disabled}
                    checked={selectedId === t.id}
                    onChange={() => setSelectedId(t.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{t.name}</span>
                      <span className="text-sm font-semibold text-indigo-700 shrink-0">
                        {formatPrice(t.costAmount, t.costCurrency)}
                      </span>
                    </div>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>
                    )}
                    {t.concessionAmount !== null && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        Concession: {formatPrice(t.concessionAmount, t.costCurrency)}
                      </p>
                    )}
                    {label && (
                      <p className={`mt-0.5 text-xs font-medium ${t.isSoldOut ? "text-red-600" : "text-amber-600"}`}>
                        {label}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </fieldset>

          {selectedId && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Your role</label>
                <div className="flex gap-3">
                  {ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showName}
                  onChange={(e) => setShowName(e.target.checked)}
                />
                Show my name on the attendee list
              </label>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!selectedId || submitting}
            className="rounded bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Booking…" : selected ? `Book — ${formatPrice(selected.costAmount, selected.costCurrency)}` : "Select a ticket"}
          </button>

          {selected?.concessionAmount !== null && selected?.concessionAmount !== undefined && selectedId && (
            <p className="text-xs text-gray-500">
              Concession rate available ({formatPrice(selected.concessionAmount, selected.costCurrency)}) — contact the organiser after booking.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

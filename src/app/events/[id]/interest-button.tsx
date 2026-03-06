"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  eventId: string;
  isInterested: boolean;
  interestedCount: number;
}

export function InterestButton({ eventId, isInterested: initialInterested, interestedCount: initialCount }: Props) {
  const router = useRouter();
  const [interested, setInterested] = useState(initialInterested);
  const [count, setCount] = useState(initialCount);
  const [submitting, setSubmitting] = useState(false);

  async function handleToggle() {
    setSubmitting(true);
    const res = await fetch("/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    if (res.ok) {
      const data = await res.json();
      setInterested(data.interested);
      setCount((prev) => prev + (data.interested ? 1 : -1));
      router.refresh();
    }
    setSubmitting(false);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={submitting}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
        interested
          ? "border-pink-300 bg-pink-50 text-pink-700"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      } disabled:opacity-50`}
    >
      {interested ? "Interested" : "Mark as interested"}
      {count > 0 && <span className="text-xs">({count})</span>}
    </button>
  );
}

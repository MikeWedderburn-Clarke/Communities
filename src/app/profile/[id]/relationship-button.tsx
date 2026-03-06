"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RelationshipType } from "@/types";

interface Props {
  targetUserId: string;
  currentRelationship: RelationshipType | null;
}

export function RelationshipButton({ targetUserId, currentRelationship }: Props) {
  const router = useRouter();
  const [relationship, setRelationship] = useState(currentRelationship);
  const [submitting, setSubmitting] = useState(false);

  async function handleSetRelationship(type: RelationshipType | null) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, type }),
      });
      if (res.ok) {
        const data = await res.json();
        setRelationship(data.type);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={submitting}
        onClick={() => handleSetRelationship(relationship === "following" ? null : "following")}
        className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
          relationship === "following"
            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        {relationship === "following" ? "Following" : "Follow"}
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={() => handleSetRelationship(relationship === "friend" ? null : "friend")}
        className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
          relationship === "friend"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        {relationship === "friend" ? "Friend" : "Add as friend"}
      </button>
    </div>
  );
}

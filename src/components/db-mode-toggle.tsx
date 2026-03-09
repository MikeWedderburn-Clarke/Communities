"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Props {
  isTestMode: boolean;
}

export function DbModeToggle({ isTestMode }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(isTestMode);

  async function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    try {
      const res = await fetch("/api/admin/db-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next ? "test" : "live" }),
      });
      if (!res.ok) {
        // Revert optimistic update on failure.
        setOptimistic(!next);
        return;
      }
    } catch {
      setOptimistic(!next);
      return;
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={optimistic ? "Switch to live database" : "Switch to test database"}
      className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold transition-colors ${
        optimistic
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${optimistic ? "bg-amber-500" : "bg-gray-400"}`} />
      {optimistic ? "TEST DB" : "LIVE DB"}
    </button>
  );
}

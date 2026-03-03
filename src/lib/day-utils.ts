import type { EventSummary } from "@/types";

// JS Date.getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// Display / sort order: Mon → Tue → Wed → Thu → Fri → Sat → Sun (rainbow, Mon first)

export const DAY_ABBR: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

/** Mon-first sort weight: Mon=0, Tue=1, …, Sat=5, Sun=6 */
export function dayOrder(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Ordered list of JS day numbers, Mon → Sun */
export const DAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Hex fill colour per JS getDay() — maximally distinct */
export const DAY_HEX: Record<number, string> = {
  1: "#dc2626", // Mon – red
  2: "#d97706", // Tue – amber
  3: "#16a34a", // Wed – green
  4: "#0891b2", // Thu – cyan
  5: "#2563eb", // Fri – blue
  6: "#7c3aed", // Sat – violet
  0: "#db2777", // Sun – pink
};

/** Tailwind border + bg classes for event cards */
export const DAY_CARD_CLS: Record<number, string> = {
  1: "border-red-500 bg-red-50/60",
  2: "border-amber-500 bg-amber-50/60",
  3: "border-green-600 bg-green-50/60",
  4: "border-cyan-600 bg-cyan-50/60",
  5: "border-blue-600 bg-blue-50/60",
  6: "border-violet-600 bg-violet-50/60",
  0: "border-pink-600 bg-pink-50/60",
};

/** Active / inactive Tailwind classes for day-filter pills */
export const DAY_PILL_CLS: Record<number, { on: string; off: string }> = {
  1: { on: "bg-red-600 text-white border-red-600",       off: "border-red-400 bg-red-100 text-red-700 hover:bg-red-200" },
  2: { on: "bg-amber-600 text-white border-amber-600",   off: "border-amber-400 bg-amber-100 text-amber-700 hover:bg-amber-200" },
  3: { on: "bg-green-600 text-white border-green-600",   off: "border-green-400 bg-green-100 text-green-700 hover:bg-green-200" },
  4: { on: "bg-cyan-600 text-white border-cyan-600",     off: "border-cyan-400 bg-cyan-100 text-cyan-700 hover:bg-cyan-200" },
  5: { on: "bg-blue-600 text-white border-blue-600",     off: "border-blue-400 bg-blue-100 text-blue-700 hover:bg-blue-200" },
  6: { on: "bg-violet-600 text-white border-violet-600", off: "border-violet-400 bg-violet-100 text-violet-700 hover:bg-violet-200" },
  0: { on: "bg-pink-600 text-white border-pink-600",     off: "border-pink-400 bg-pink-100 text-pink-700 hover:bg-pink-200" },
};

export function getEventDay(event: Pick<EventSummary, "nextOccurrence" | "dateTime">): number {
  const dt = event.nextOccurrence?.dateTime ?? event.dateTime;
  return new Date(dt).getDay();
}

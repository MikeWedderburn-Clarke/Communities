import type { EventSummary } from "@/types";

function toTimestamp(value: string): number {
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

export function isEventFresh(event: Pick<EventSummary, "dateAdded" | "lastUpdated">, since: string | null): boolean {
  if (!since) return false;
  const sinceTs = toTimestamp(since);
  if (sinceTs === 0) return false;
  return toTimestamp(event.dateAdded) > sinceTs || toTimestamp(event.lastUpdated) > sinceTs;
}

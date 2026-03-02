import type { EventSummary } from "@/types";

function toTimestamp(value: string): number {
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

export function isEventNew(event: Pick<EventSummary, "dateAdded">, since: string | null): boolean {
  if (!since) return false;
  const sinceTs = toTimestamp(since);
  return sinceTs > 0 && toTimestamp(event.dateAdded) > sinceTs;
}

export function isEventUpdated(event: Pick<EventSummary, "dateAdded" | "lastUpdated">, since: string | null): boolean {
  if (!since) return false;
  const sinceTs = toTimestamp(since);
  return sinceTs > 0 && toTimestamp(event.lastUpdated) > sinceTs && toTimestamp(event.dateAdded) <= sinceTs;
}

export function isEventFresh(event: Pick<EventSummary, "dateAdded" | "lastUpdated">, since: string | null): boolean {
  return isEventNew(event, since) || isEventUpdated(event, since);
}

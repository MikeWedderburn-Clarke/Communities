import type { EventSummary, RecurrenceFrequency } from "@/types";

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

// ── Recurrence helpers ────────────────────────────────────────────────────────

// Maximum iterations when fast-forwarding past the start of a date range.
const MAX_RECURRENCE_FAST_FORWARD = 2000;
// Maximum occurrences collected within a single calendar month (daily * 31 + headroom).
const MAX_MONTH_OCCURRENCES = 200;

/** Advance a local-time Date by one recurrence interval. */
function advanceLocal(d: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(d);
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "monthly") {
    const targetMonth = (next.getMonth() + 1) % 12;
    next.setMonth(next.getMonth() + 1);
    // setMonth overflows when the day doesn't exist in the target month
    // (e.g. Jan 31 → would become Mar 3); clamp to last day of intended month.
    if (next.getMonth() !== targetMonth) next.setDate(0);
  }
  return next;
}

/** Strip time from a Date (local midnight). */
function localDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Returns true when the event has at least one occurrence whose calendar date
 * falls within [rangeStart, rangeEnd] inclusive (date-only comparison).
 * Recurring events are walked forward from their base dateTime.
 */
export function hasOccurrenceInRange(
  event: Pick<EventSummary, "dateTime" | "recurrence">,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const startD = localDay(rangeStart);
  const endD   = localDay(rangeEnd);
  const baseD  = localDay(new Date(event.dateTime));

  if (!event.recurrence || event.recurrence.frequency === "none") {
    return baseD >= startD && baseD <= endD;
  }

  const freq   = event.recurrence.frequency;
  const recEnd = event.recurrence.endDate ? localDay(new Date(event.recurrence.endDate)) : null;

  let cur = baseD;
  for (let i = 0; i < MAX_RECURRENCE_FAST_FORWARD; i++) {
    if (recEnd && cur > recEnd) break;
    if (cur > endD) break;
    if (cur >= startD) return true;
    const next = advanceLocal(cur, freq);
    if (next.getTime() === cur.getTime()) break;
    cur = next;
  }
  return false;
}

/**
 * Returns all calendar dates within the given year/month on which the event
 * has an occurrence. Used to highlight days in the EventCalendar grid.
 */
export function getOccurrenceDatesInMonth(
  event: Pick<EventSummary, "dateTime" | "recurrence">,
  year: number,
  month: number,
): Date[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  const baseD      = localDay(new Date(event.dateTime));

  if (!event.recurrence || event.recurrence.frequency === "none") {
    return baseD >= monthStart && baseD <= monthEnd ? [baseD] : [];
  }

  const freq   = event.recurrence.frequency;
  const recEnd = event.recurrence.endDate ? localDay(new Date(event.recurrence.endDate)) : null;

  const results: Date[] = [];
  let cur = baseD;

  // Fast-forward to first occurrence on or after monthStart
  for (let i = 0; i < MAX_RECURRENCE_FAST_FORWARD; i++) {
    if (recEnd && cur > recEnd) return results;
    if (cur >= monthStart) break;
    const next = advanceLocal(cur, freq);
    if (next.getTime() === cur.getTime()) return results;
    cur = next;
  }

  // Collect occurrences within the month
  for (let i = 0; i < MAX_MONTH_OCCURRENCES; i++) {
    if (cur > monthEnd) break;
    if (recEnd && cur > recEnd) break;
    results.push(new Date(cur));
    const next = advanceLocal(cur, freq);
    if (next.getTime() === cur.getTime()) break;
    cur = next;
  }
  return results;
}

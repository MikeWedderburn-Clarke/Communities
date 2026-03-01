import type { RecurrenceRule, RecurrenceFrequency, EventOccurrence } from "@/types";

/**
 * Compute the next occurrence for an event relative to the supplied reference ISO timestamp.
 * Returns null when the event (and any recurrence) has fully elapsed.
 */
export function computeNextOccurrence(
  startIso: string,
  endIso: string,
  recurrence: RecurrenceRule | null,
  referenceIso: string = new Date().toISOString(),
): EventOccurrence | null {
  const startDate = new Date(startIso);
  const endDate = new Date(endIso);
  const referenceDate = new Date(referenceIso);

  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
    return null;
  }

  if (!recurrence || recurrence.frequency === "none") {
    return startDate >= referenceDate
      ? { dateTime: startDate.toISOString(), endDateTime: endDate.toISOString() }
      : null;
  }

  let currentStart = startDate;
  let currentEnd = endDate;
  const limit = recurrence.endDate ? new Date(recurrence.endDate) : null;
  let iterations = 0;

  while (currentStart < referenceDate) {
    if (limit && currentStart > limit) {
      return null;
    }
    iterations++;
    if (iterations > 2000) {
      // Safety guard against an infinite loop if something goes wrong with the inputs.
      return null;
    }
    const nextStart = addInterval(currentStart, recurrence.frequency);
    const nextEnd = addInterval(currentEnd, recurrence.frequency);
    currentStart = nextStart;
    currentEnd = nextEnd;
  }

  if (limit && currentStart > limit) {
    return null;
  }

  return {
    dateTime: currentStart.toISOString(),
    endDateTime: currentEnd.toISOString(),
  };
}

function addInterval(date: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(date.getTime());
  switch (frequency) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    default:
      break;
  }
  return next;
}

export function formatRecurrenceSummary(rule: RecurrenceRule | null): string | null {
  if (!rule || rule.frequency === "none") return null;
  const label =
    rule.frequency === "daily"
      ? "Repeats daily"
      : rule.frequency === "weekly"
        ? "Repeats weekly"
        : "Repeats monthly";
  if (!rule.endDate) {
    return label;
  }
  const end = new Date(rule.endDate);
  if (Number.isNaN(end.valueOf())) {
    return label;
  }
  const endStr = end.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${label} until ${endStr}`;
}

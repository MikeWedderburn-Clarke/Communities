import { describe, it, expect } from "vitest";
import { isEventNew, isEventUpdated, isEventFresh, getOccurrenceDatesInMonth } from "@/lib/event-utils";

const SINCE = "2026-02-22T00:00:00Z";

function makeEvent(overrides: { dateAdded?: string; lastUpdated?: string }) {
  return {
    dateAdded:   overrides.dateAdded   ?? "2026-01-01T00:00:00Z",
    lastUpdated: overrides.lastUpdated ?? "2026-01-01T00:00:00Z",
  };
}

describe("isEventNew", () => {
  it("returns false when since is null", () => {
    expect(isEventNew(makeEvent({ dateAdded: "2026-03-01T00:00:00Z" }), null)).toBe(false);
  });

  it("returns true when dateAdded is after since", () => {
    expect(isEventNew(makeEvent({ dateAdded: "2026-03-01T00:00:00Z" }), SINCE)).toBe(true);
  });

  it("returns false when dateAdded equals since", () => {
    expect(isEventNew(makeEvent({ dateAdded: SINCE }), SINCE)).toBe(false);
  });

  it("returns false when dateAdded is before since", () => {
    expect(isEventNew(makeEvent({ dateAdded: "2026-01-01T00:00:00Z" }), SINCE)).toBe(false);
  });

  it("returns false when event was updated after since but not created after since", () => {
    expect(isEventNew(makeEvent({ dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-03-01T00:00:00Z" }), SINCE)).toBe(false);
  });
});

describe("isEventUpdated", () => {
  it("returns false when since is null", () => {
    expect(isEventUpdated(makeEvent({ lastUpdated: "2026-03-01T00:00:00Z" }), null)).toBe(false);
  });

  it("returns true when lastUpdated is after since and dateAdded is before since", () => {
    expect(isEventUpdated(makeEvent({ dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-03-01T00:00:00Z" }), SINCE)).toBe(true);
  });

  it("returns false when lastUpdated is after since but dateAdded is also after since (it's new, not updated)", () => {
    expect(isEventUpdated(makeEvent({ dateAdded: "2026-03-01T00:00:00Z", lastUpdated: "2026-03-02T00:00:00Z" }), SINCE)).toBe(false);
  });

  it("returns false when lastUpdated is before since", () => {
    expect(isEventUpdated(makeEvent({ dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-15T00:00:00Z" }), SINCE)).toBe(false);
  });

  it("returns false when lastUpdated equals since", () => {
    expect(isEventUpdated(makeEvent({ dateAdded: "2026-01-01T00:00:00Z", lastUpdated: SINCE }), SINCE)).toBe(false);
  });
});

describe("isEventFresh", () => {
  it("returns true for new events (dateAdded after since)", () => {
    expect(isEventFresh(makeEvent({ dateAdded: "2026-03-01T00:00:00Z" }), SINCE)).toBe(true);
  });

  it("returns true for updated events (lastUpdated after since, dateAdded before)", () => {
    expect(isEventFresh(makeEvent({ dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-03-01T00:00:00Z" }), SINCE)).toBe(true);
  });

  it("returns false for old events (both before since)", () => {
    expect(isEventFresh(makeEvent({ dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-15T00:00:00Z" }), SINCE)).toBe(false);
  });

  it("returns false when since is null", () => {
    expect(isEventFresh(makeEvent({ dateAdded: "2026-03-01T00:00:00Z", lastUpdated: "2026-03-01T00:00:00Z" }), null)).toBe(false);
  });
});

// ── Monthly recurrence boundary ────────────────────────────────────────────────

function makeMonthlyEvent(startIso: string) {
  return {
    dateTime: startIso,
    recurrence: { frequency: "monthly" as const, endDate: "2027-12-31T23:59:59Z" },
  };
}

describe("getOccurrenceDatesInMonth — monthly recurrence at month boundary", () => {
  it("lands on Feb 28 (not Mar 3) when event starts Jan 31", () => {
    const event = makeMonthlyEvent("2026-01-31T10:00:00Z");
    const feb = getOccurrenceDatesInMonth(event, 2026, 1); // month 1 = February
    expect(feb).toHaveLength(1);
    expect(feb[0].getMonth()).toBe(1);   // February
    expect(feb[0].getDate()).toBe(28);
  });

  it("all returned dates remain within the requested month", () => {
    const event = makeMonthlyEvent("2026-01-31T10:00:00Z");
    const feb = getOccurrenceDatesInMonth(event, 2026, 1);
    expect(feb.every((d) => d.getMonth() === 1)).toBe(true);
  });

  it("lands on Feb 29 in a leap year", () => {
    const event = makeMonthlyEvent("2024-01-31T10:00:00Z");
    const feb = getOccurrenceDatesInMonth(event, 2024, 1); // 2024 is a leap year
    expect(feb).toHaveLength(1);
    expect(feb[0].getMonth()).toBe(1);
    expect(feb[0].getDate()).toBe(29);
  });

  it("works normally for mid-month events (no overflow)", () => {
    const event = makeMonthlyEvent("2026-01-15T10:00:00Z");
    const feb = getOccurrenceDatesInMonth(event, 2026, 1);
    expect(feb).toHaveLength(1);
    expect(feb[0].getDate()).toBe(15);
  });
});

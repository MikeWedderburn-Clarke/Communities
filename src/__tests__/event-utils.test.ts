import { describe, it, expect } from "vitest";
import { isEventNew, isEventUpdated, isEventFresh } from "@/lib/event-utils";

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

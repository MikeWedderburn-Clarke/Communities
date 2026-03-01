import { describe, it, expect } from "vitest";
import { computeNextOccurrence, formatRecurrenceSummary } from "@/lib/recurrence";

describe("computeNextOccurrence", () => {
  it("returns the original start when the event is still upcoming", () => {
    const occurrence = computeNextOccurrence(
      "2026-05-01T10:00:00Z",
      "2026-05-01T12:00:00Z",
      null,
      "2026-04-01T09:00:00Z",
    );
    expect(occurrence).toEqual({ dateTime: "2026-05-01T10:00:00.000Z", endDateTime: "2026-05-01T12:00:00.000Z" });
  });

  it("returns null when a one-off event is already in the past", () => {
    const occurrence = computeNextOccurrence(
      "2024-01-01T10:00:00Z",
      "2024-01-01T12:00:00Z",
      null,
      "2026-04-01T09:00:00Z",
    );
    expect(occurrence).toBeNull();
  });

  it("rolls recurring events forward until the next instance", () => {
    const occurrence = computeNextOccurrence(
      "2026-01-01T10:00:00Z",
      "2026-01-01T12:00:00Z",
      { frequency: "weekly", endDate: "2026-12-31T23:59:59Z" },
      "2026-02-10T09:00:00Z",
    );
    expect(occurrence).not.toBeNull();
    expect(occurrence?.dateTime).toBe("2026-02-12T10:00:00.000Z");
  });

  it("stops recurring once the end date has passed", () => {
    const occurrence = computeNextOccurrence(
      "2026-01-01T10:00:00Z",
      "2026-01-01T12:00:00Z",
      { frequency: "weekly", endDate: "2026-01-31T23:59:59Z" },
      "2026-03-01T09:00:00Z",
    );
    expect(occurrence).toBeNull();
  });
});

describe("formatRecurrenceSummary", () => {
  it("returns null for non-recurring events", () => {
    expect(formatRecurrenceSummary(null)).toBeNull();
  });

  it("describes the cadence and end date", () => {
    const summary = formatRecurrenceSummary({ frequency: "weekly", endDate: "2026-06-30T23:59:59Z" });
    expect(summary).toContain("Repeats weekly");
    expect(summary).toContain("Jun");
  });
});

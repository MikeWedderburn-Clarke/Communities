import { describe, it, expect } from "vitest";
import { validateRsvpInput, validateEventInput } from "@/services/validation";

describe("validateRsvpInput", () => {
  it("accepts valid input", () => {
    const result = validateRsvpInput({
      eventId: "evt-1",
      role: "Base",
      showName: true,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toEqual({ eventId: "evt-1", role: "Base", showName: true, isTeaching: false });
    }
  });

  it("accepts valid input with isTeaching=true", () => {
    const result = validateRsvpInput({
      eventId: "evt-1",
      role: "Flyer",
      showName: false,
      isTeaching: true,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toEqual({ eventId: "evt-1", role: "Flyer", showName: false, isTeaching: true });
    }
  });

  it("accepts all valid roles", () => {
    for (const role of ["Base", "Flyer", "Hybrid"]) {
      const result = validateRsvpInput({ eventId: "evt-1", role, showName: false });
      expect(result.valid).toBe(true);
    }
  });

  it("rejects invalid role", () => {
    const result = validateRsvpInput({ eventId: "evt-1", role: "Dancer", showName: true });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "role")).toBe(true);
    }
  });

  it("rejects Spotter as invalid role", () => {
    const result = validateRsvpInput({ eventId: "evt-1", role: "Spotter", showName: true });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "role")).toBe(true);
    }
  });

  it("rejects missing eventId", () => {
    const result = validateRsvpInput({ role: "Base", showName: true });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "eventId")).toBe(true);
    }
  });

  it("rejects empty eventId", () => {
    const result = validateRsvpInput({ eventId: "  ", role: "Base", showName: true });
    expect(result.valid).toBe(false);
  });

  it("rejects non-boolean showName", () => {
    const result = validateRsvpInput({ eventId: "evt-1", role: "Base", showName: "yes" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "showName")).toBe(true);
    }
  });

  it("rejects null body", () => {
    const result = validateRsvpInput(null);
    expect(result.valid).toBe(false);
  });

  it("rejects non-object body", () => {
    const result = validateRsvpInput("string");
    expect(result.valid).toBe(false);
  });

  it("trims eventId whitespace", () => {
    const result = validateRsvpInput({ eventId: "  evt-1  ", role: "Base", showName: true });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.eventId).toBe("evt-1");
    }
  });

  it("isTeaching defaults to false when omitted", () => {
    const result = validateRsvpInput({ eventId: "evt-1", role: "Base", showName: true });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.isTeaching).toBe(false);
    }
  });

  it("accepts isTeaching as boolean true", () => {
    const result = validateRsvpInput({ eventId: "evt-1", role: "Base", showName: true, isTeaching: true });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.isTeaching).toBe(true);
    }
  });

  it("accepts isTeaching as boolean false", () => {
    const result = validateRsvpInput({ eventId: "evt-1", role: "Base", showName: true, isTeaching: false });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.isTeaching).toBe(false);
    }
  });

  it("rejects non-boolean isTeaching", () => {
    const result = validateRsvpInput({ eventId: "evt-1", role: "Base", showName: true, isTeaching: "yes" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "isTeaching")).toBe(true);
    }
  });
});

describe("validateEventInput", () => {
  const validEvent = {
    title: "Sunday Jam",
    description: "A fun jam session",
    dateTime: "2026-04-01T10:00:00Z",
    endDateTime: "2026-04-01T12:00:00Z",
    locationId: "loc-regents-park",
  };

  it("accepts valid input", () => {
    const result = validateEventInput(validEvent);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.title).toBe("Sunday Jam");
    }
  });

  it("trims whitespace from all string fields", () => {
    const result = validateEventInput({
      ...validEvent,
      title: "  Sunday Jam  ",
      locationId: "  loc-regents-park  ",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.title).toBe("Sunday Jam");
      expect(result.data.locationId).toBe("loc-regents-park");
    }
  });

  it("rejects missing title", () => {
    const { title, ...rest } = validEvent;
    const result = validateEventInput(rest);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "title")).toBe(true);
    }
  });

  it("rejects empty description", () => {
    const result = validateEventInput({ ...validEvent, description: "  " });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "description")).toBe(true);
    }
  });

  it("rejects invalid dateTime", () => {
    const result = validateEventInput({ ...validEvent, dateTime: "not-a-date" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "dateTime")).toBe(true);
    }
  });

  it("rejects endDateTime before dateTime", () => {
    const result = validateEventInput({
      ...validEvent,
      dateTime: "2026-04-01T12:00:00Z",
      endDateTime: "2026-04-01T10:00:00Z",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "endDateTime")).toBe(true);
    }
  });

  it("rejects endDateTime equal to dateTime", () => {
    const result = validateEventInput({
      ...validEvent,
      dateTime: "2026-04-01T10:00:00Z",
      endDateTime: "2026-04-01T10:00:00Z",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects null body", () => {
    const result = validateEventInput(null);
    expect(result.valid).toBe(false);
  });

  it("rejects title over 200 characters", () => {
    const result = validateEventInput({ ...validEvent, title: "x".repeat(201) });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "title")).toBe(true);
    }
  });

  it("collects multiple errors at once", () => {
    const result = validateEventInput({ title: "", description: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("accepts valid recurrence payloads", () => {
    const result = validateEventInput({
      ...validEvent,
      recurrence: { frequency: "weekly", endDate: "2026-06-30T23:59:59Z" },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.recurrence).toEqual({ frequency: "weekly", endDate: "2026-06-30T23:59:59Z" });
    }
  });

  it("requires an end date when recurrence is enabled", () => {
    const result = validateEventInput({
      ...validEvent,
      recurrence: { frequency: "weekly" },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "recurrence.endDate")).toBe(true);
    }
  });

  it("rejects recurrence end dates earlier than the start", () => {
    const result = validateEventInput({
      ...validEvent,
      recurrence: { frequency: "weekly", endDate: "2025-01-01T00:00:00Z" },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "recurrence.endDate")).toBe(true);
    }
  });

  it("rejects recurrence frequency outside the allowed list", () => {
    const result = validateEventInput({
      ...validEvent,
      recurrence: { frequency: "hourly", endDate: "2026-06-30T23:59:59Z" },
    } as any);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "recurrence.frequency")).toBe(true);
    }
  });

  // ── skillLevel ────────────────────────────────────────────────────────────

  it("defaults skillLevel to 'All levels' when omitted", () => {
    const result = validateEventInput(validEvent);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.skillLevel).toBe("All levels");
    }
  });

  it("accepts every valid skill level", () => {
    for (const level of ["Beginner", "Intermediate", "Advanced", "All levels"]) {
      const result = validateEventInput({ ...validEvent, skillLevel: level });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.skillLevel).toBe(level);
      }
    }
  });

  it("rejects an unrecognised skill level", () => {
    const result = validateEventInput({ ...validEvent, skillLevel: "Expert" } as any);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "skillLevel")).toBe(true);
    }
  });

  // ── prerequisites ─────────────────────────────────────────────────────────

  it("accepts a valid prerequisites string", () => {
    const result = validateEventInput({ ...validEvent, prerequisites: "• Can invert\n• 6 months experience" });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.prerequisites).toBe("• Can invert\n• 6 months experience");
    }
  });

  it("stores null when prerequisites is omitted", () => {
    const result = validateEventInput(validEvent);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.prerequisites).toBeNull();
    }
  });

  it("stores null when prerequisites is empty string", () => {
    const result = validateEventInput({ ...validEvent, prerequisites: "" });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.prerequisites).toBeNull();
    }
  });

  it("rejects prerequisites over 2000 characters", () => {
    const result = validateEventInput({ ...validEvent, prerequisites: "x".repeat(2001) });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "prerequisites")).toBe(true);
    }
  });

  // ── cost ──────────────────────────────────────────────────────────────────

  it("accepts a valid cost with currency", () => {
    const result = validateEventInput({ ...validEvent, costAmount: 10, costCurrency: "GBP" });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.costAmount).toBe(10);
      expect(result.data.costCurrency).toBe("GBP");
    }
  });

  it("stores null cost fields when omitted", () => {
    const result = validateEventInput(validEvent);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.costAmount).toBeNull();
      expect(result.data.costCurrency).toBeNull();
    }
  });

  it("rejects a negative costAmount", () => {
    const result = validateEventInput({ ...validEvent, costAmount: -5, costCurrency: "GBP" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "costAmount")).toBe(true);
    }
  });

  it("requires costCurrency when costAmount is set", () => {
    const result = validateEventInput({ ...validEvent, costAmount: 10 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "costCurrency")).toBe(true);
    }
  });

  it("normalises costCurrency to uppercase", () => {
    const result = validateEventInput({ ...validEvent, costAmount: 10, costCurrency: "gbp" });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.costCurrency).toBe("GBP");
    }
  });

  it("accepts zero as a valid costAmount (free but explicit)", () => {
    const result = validateEventInput({ ...validEvent, costAmount: 0, costCurrency: "GBP" });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.costAmount).toBe(0);
    }
  });

  // ── concessionAmount ──────────────────────────────────────────────────────

  it("accepts a concession amount when cost is set", () => {
    const result = validateEventInput({ ...validEvent, costAmount: 15, costCurrency: "GBP", concessionAmount: 10 });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.concessionAmount).toBe(10);
    }
  });

  it("rejects concessionAmount when no costAmount is given", () => {
    const result = validateEventInput({ ...validEvent, concessionAmount: 5 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "concessionAmount")).toBe(true);
    }
  });

  it("rejects a negative concessionAmount", () => {
    const result = validateEventInput({ ...validEvent, costAmount: 15, costCurrency: "GBP", concessionAmount: -1 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "concessionAmount")).toBe(true);
    }
  });

  it("stores null concessionAmount when omitted", () => {
    const result = validateEventInput({ ...validEvent, costAmount: 15, costCurrency: "GBP" });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.concessionAmount).toBeNull();
    }
  });
});
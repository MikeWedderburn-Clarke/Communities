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
});
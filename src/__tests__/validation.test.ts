import { describe, it, expect } from "vitest";
import { validateRsvpInput } from "@/services/validation";

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

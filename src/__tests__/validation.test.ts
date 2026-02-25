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
      expect(result.data).toEqual({ eventId: "evt-1", role: "Base", showName: true });
    }
  });

  it("accepts all valid roles", () => {
    for (const role of ["Base", "Flyer", "Hybrid", "Spotter"]) {
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
});

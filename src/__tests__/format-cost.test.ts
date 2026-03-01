import { describe, it, expect } from "vitest";
import { formatCost } from "@/lib/format-cost";

describe("formatCost", () => {
  it("formats GBP correctly", () => {
    expect(formatCost(10, "GBP")).toBe("£10.00");
  });

  it("formats USD correctly", () => {
    expect(formatCost(25.5, "USD")).toBe("US$25.50");
  });

  it("formats EUR correctly", () => {
    expect(formatCost(8, "EUR")).toBe("€8.00");
  });

  it("returns plain number string when currency is null", () => {
    expect(formatCost(15, null)).toBe("15");
  });

  it("formats unknown currency codes without throwing", () => {
    const result = formatCost(5, "XYZ");
    expect(result).toContain("XYZ");
    expect(result).toContain("5");
  });

  it("formats zero correctly", () => {
    expect(formatCost(0, "GBP")).toBe("£0.00");
  });

  it("formats fractional amounts correctly", () => {
    expect(formatCost(9.99, "GBP")).toBe("£9.99");
  });
});

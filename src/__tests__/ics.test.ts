import { describe, it, expect } from "vitest";
import { generateIcs } from "@/services/ics";

describe("generateIcs", () => {
  const event = {
    id: "evt-test",
    title: "Test Event",
    description: "A test event for unit testing",
    dateTime: "2026-03-08T11:00:00Z",
    endDateTime: "2026-03-08T14:00:00Z",
    location: "Test Location, London",
  };

  it("returns a valid iCalendar string", () => {
    const ics = generateIcs(event);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("includes event details", () => {
    const ics = generateIcs(event);
    expect(ics).toContain("SUMMARY:Test Event");
    expect(ics).toContain("LOCATION:Test Location\\, London");
    expect(ics).toContain("DTSTART:20260308T110000Z");
    expect(ics).toContain("DTEND:20260308T140000Z");
  });

  it("generates a stable UID", () => {
    const ics = generateIcs(event);
    expect(ics).toContain("UID:evt-test@acroyoga-community");
  });

  it("escapes special characters in description", () => {
    const withSpecials = { ...event, description: "Line1\nLine2; with commas, and backslash\\" };
    const ics = generateIcs(withSpecials);
    expect(ics).toContain("DESCRIPTION:Line1\\nLine2\\; with commas\\, and backslash\\\\");
  });

  it("uses CRLF line endings", () => {
    const ics = generateIcs(event);
    expect(ics).toContain("\r\n");
  });
});

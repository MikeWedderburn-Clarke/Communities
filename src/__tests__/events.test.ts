import { describe, it, expect } from "vitest";
import { aggregateRoles, visibleAttendees } from "@/services/events";

describe("aggregateRoles", () => {
  it("returns zeroes for empty list", () => {
    expect(aggregateRoles([])).toEqual({
      Base: 0,
      Flyer: 0,
      Hybrid: 0,
      Spotter: 0,
    });
  });

  it("counts each role correctly", () => {
    const rsvps = [
      { role: "Base" },
      { role: "Base" },
      { role: "Flyer" },
      { role: "Hybrid" },
      { role: "Spotter" },
      { role: "Spotter" },
    ];
    expect(aggregateRoles(rsvps)).toEqual({
      Base: 2,
      Flyer: 1,
      Hybrid: 1,
      Spotter: 2,
    });
  });

  it("ignores unknown roles", () => {
    const rsvps = [{ role: "Base" }, { role: "Unknown" }];
    expect(aggregateRoles(rsvps)).toEqual({
      Base: 1,
      Flyer: 0,
      Hybrid: 0,
      Spotter: 0,
    });
  });
});

describe("visibleAttendees", () => {
  const rsvps = [
    { showName: true, role: "Base", userName: "Alice" },
    { showName: false, role: "Flyer", userName: "Bob" },
    { showName: true, role: "Spotter", userName: "Carol" },
    { showName: false, role: "Hybrid", userName: "Dan" },
  ];

  it("only returns attendees with showName=true", () => {
    const result = visibleAttendees(rsvps);
    expect(result).toEqual([
      { name: "Alice", role: "Base" },
      { name: "Carol", role: "Spotter" },
    ]);
  });

  it("never includes attendees with showName=false", () => {
    const result = visibleAttendees(rsvps);
    const names = result.map((a) => a.name);
    expect(names).not.toContain("Bob");
    expect(names).not.toContain("Dan");
  });

  it("returns empty array when no one opted in", () => {
    const allHidden = [
      { showName: false, role: "Base", userName: "Alice" },
      { showName: false, role: "Flyer", userName: "Bob" },
    ];
    expect(visibleAttendees(allHidden)).toEqual([]);
  });

  it("returns all when everyone opted in", () => {
    const allVisible = [
      { showName: true, role: "Base", userName: "Alice" },
      { showName: true, role: "Flyer", userName: "Bob" },
    ];
    expect(visibleAttendees(allVisible)).toHaveLength(2);
  });
});

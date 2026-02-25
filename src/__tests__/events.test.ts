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
    { showName: true, role: "Base", userName: "Alice", userId: "u1" },
    { showName: false, role: "Flyer", userName: "Bob", userId: "u2" },
    { showName: true, role: "Spotter", userName: "Carol", userId: "u3" },
    { showName: false, role: "Hybrid", userName: "Dan", userId: "u4" },
  ];

  it("only returns attendees with showName=true for regular users", () => {
    const result = visibleAttendees(rsvps, "u1", false);
    expect(result).toEqual([
      { name: "Alice", role: "Base", hidden: false },
      { name: "Carol", role: "Spotter", hidden: false },
    ]);
  });

  it("never includes other users with showName=false for regular users", () => {
    const result = visibleAttendees(rsvps, "u1", false);
    const names = result.map((a) => a.name);
    expect(names).not.toContain("Bob");
    expect(names).not.toContain("Dan");
  });

  it("includes the viewer's own entry with hidden=true when showName=false", () => {
    // Bob (u2) has showName=false, viewing as Bob
    const result = visibleAttendees(rsvps, "u2", false);
    const bob = result.find((a) => a.name === "Bob");
    expect(bob).toEqual({ name: "Bob", role: "Flyer", hidden: true });
    // Alice and Carol still visible
    expect(result).toHaveLength(3);
  });

  it("admin sees ALL attendees", () => {
    const result = visibleAttendees(rsvps, "u4", true);
    expect(result).toHaveLength(4);
  });

  it("admin sees hidden=true for showName=false attendees", () => {
    const result = visibleAttendees(rsvps, "u4", true);
    const bob = result.find((a) => a.name === "Bob");
    expect(bob).toEqual({ name: "Bob", role: "Flyer", hidden: true });
    const alice = result.find((a) => a.name === "Alice");
    expect(alice).toEqual({ name: "Alice", role: "Base", hidden: false });
  });

  it("returns empty array when no one opted in (non-admin, not self)", () => {
    const allHidden = [
      { showName: false, role: "Base", userName: "Alice", userId: "u1" },
      { showName: false, role: "Flyer", userName: "Bob", userId: "u2" },
    ];
    // Viewer is u3 who is not in the list
    expect(visibleAttendees(allHidden, "u3", false)).toEqual([]);
  });

  it("returns all when everyone opted in", () => {
    const allVisible = [
      { showName: true, role: "Base", userName: "Alice", userId: "u1" },
      { showName: true, role: "Flyer", userName: "Bob", userId: "u2" },
    ];
    const result = visibleAttendees(allVisible, "u1", false);
    expect(result).toHaveLength(2);
    expect(result.every((a) => !a.hidden)).toBe(true);
  });
});

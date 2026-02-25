import { describe, it, expect } from "vitest";
import { aggregateRoles, visibleAttendees } from "@/services/events";

describe("aggregateRoles", () => {
  it("returns zeroes for empty list", () => {
    expect(aggregateRoles([])).toEqual({
      Base: 0,
      Flyer: 0,
      Hybrid: 0,
    });
  });

  it("counts each role correctly", () => {
    const rsvps = [
      { role: "Base" },
      { role: "Base" },
      { role: "Flyer" },
      { role: "Hybrid" },
      { role: "Hybrid" },
    ];
    expect(aggregateRoles(rsvps)).toEqual({
      Base: 2,
      Flyer: 1,
      Hybrid: 2,
    });
  });

  it("ignores unknown roles", () => {
    const rsvps = [{ role: "Base" }, { role: "Unknown" }];
    expect(aggregateRoles(rsvps)).toEqual({
      Base: 1,
      Flyer: 0,
      Hybrid: 0,
    });
  });
});

describe("visibleAttendees", () => {
  const socialDefaults = { facebookUrl: null, instagramUrl: null, websiteUrl: null, youtubeUrl: null, showFacebook: false, showInstagram: false, showWebsite: false, showYoutube: false };
  const rsvps = [
    { showName: true, role: "Base", userName: "Alice", userId: "u1", isTeaching: false, ...socialDefaults },
    { showName: false, role: "Flyer", userName: "Bob", userId: "u2", isTeaching: false, ...socialDefaults },
    { showName: true, role: "Hybrid", userName: "Carol", userId: "u3", isTeaching: false, ...socialDefaults },
    { showName: false, role: "Hybrid", userName: "Dan", userId: "u4", isTeaching: false, ...socialDefaults },
  ];

  it("only returns attendees with showName=true for regular users", () => {
    const result = visibleAttendees(rsvps, "u1", false);
    expect(result).toEqual([
      { userId: "u1", name: "Alice", role: "Base", hidden: false, isTeaching: false, socialLinks: {} },
      { userId: "u3", name: "Carol", role: "Hybrid", hidden: false, isTeaching: false, socialLinks: {} },
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
    expect(bob).toEqual({ userId: "u2", name: "Bob", role: "Flyer", hidden: true, isTeaching: false, socialLinks: {} });
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
    expect(bob).toEqual({ userId: "u2", name: "Bob", role: "Flyer", hidden: true, isTeaching: false, socialLinks: {} });
    const alice = result.find((a) => a.name === "Alice");
    expect(alice).toEqual({ userId: "u1", name: "Alice", role: "Base", hidden: false, isTeaching: false, socialLinks: {} });
  });

  it("returns empty array when no one opted in (non-admin, not self)", () => {
    const allHidden = [
      { showName: false, role: "Base", userName: "Alice", userId: "u1", isTeaching: false, ...socialDefaults },
      { showName: false, role: "Flyer", userName: "Bob", userId: "u2", isTeaching: false, ...socialDefaults },
    ];
    // Viewer is u3 who is not in the list
    expect(visibleAttendees(allHidden, "u3", false)).toEqual([]);
  });

  it("returns all when everyone opted in", () => {
    const allVisible = [
      { showName: true, role: "Base", userName: "Alice", userId: "u1", isTeaching: false, ...socialDefaults },
      { showName: true, role: "Flyer", userName: "Bob", userId: "u2", isTeaching: false, ...socialDefaults },
    ];
    const result = visibleAttendees(allVisible, "u1", false);
    expect(result).toHaveLength(2);
    expect(result.every((a) => !a.hidden)).toBe(true);
  });

  it("includes isTeaching=true in output when attendee is teaching", () => {
    const teachingRsvps = [
      { showName: true, role: "Base", userName: "Alice", userId: "u1", isTeaching: true, ...socialDefaults },
      { showName: true, role: "Flyer", userName: "Bob", userId: "u2", isTeaching: false, ...socialDefaults },
    ];
    const result = visibleAttendees(teachingRsvps, "u1", false);
    const alice = result.find((a) => a.name === "Alice");
    expect(alice).toEqual({ userId: "u1", name: "Alice", role: "Base", hidden: false, isTeaching: true, socialLinks: {} });
    const bob = result.find((a) => a.name === "Bob");
    expect(bob).toEqual({ userId: "u2", name: "Bob", role: "Flyer", hidden: false, isTeaching: false, socialLinks: {} });
  });

  it("includes visible social links in output", () => {
    const socialRsvps = [
      { showName: true, role: "Base", userName: "Alice", userId: "u1", isTeaching: false, facebookUrl: "https://facebook.com/alice", instagramUrl: "https://instagram.com/alice", websiteUrl: null, youtubeUrl: null, showFacebook: true, showInstagram: true, showWebsite: false, showYoutube: false },
      { showName: true, role: "Flyer", userName: "Bob", userId: "u2", isTeaching: false, facebookUrl: "https://facebook.com/bob", instagramUrl: null, websiteUrl: null, youtubeUrl: null, showFacebook: false, showInstagram: false, showWebsite: false, showYoutube: false },
    ];
    const result = visibleAttendees(socialRsvps, "u1", false);
    expect(result[0].socialLinks).toEqual({ facebook: "https://facebook.com/alice", instagram: "https://instagram.com/alice" });
    expect(result[1].socialLinks).toEqual({});
  });
});

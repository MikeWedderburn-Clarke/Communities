import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/db/test-utils";
import * as schema from "@/db/schema";
import {
  getUserProfile,
  getPublicProfile,
  updateUserProfile,
  validateProfileInput,
} from "@/services/users";

type TestDb = ReturnType<typeof createTestDb>;

function seedUser(db: TestDb) {
  db.insert(schema.users).values({
    id: "u1",
    name: "Alice",
    email: "alice@test.com",
    isAdmin: false,
    defaultRole: "Base",
    defaultShowName: true,
    facebookUrl: "https://facebook.com/alice",
    instagramUrl: "https://instagram.com/alice",
    websiteUrl: "https://alice.dev",
    youtubeUrl: "https://youtube.com/alice",
    showFacebook: true,
    showInstagram: false,
    showWebsite: true,
    showYoutube: false,
  }).run();
}

describe("getUserProfile", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
    seedUser(db);
  });

  it("returns full profile data for existing user", async () => {
    const profile = await getUserProfile(db, "u1");
    expect(profile).toEqual({
      id: "u1",
      name: "Alice",
      email: "alice@test.com",
      isTeacherApproved: false,
      teacherRequestedAt: null,
      defaultRole: "Base",
      defaultShowName: true,
      homeCity: null,
      useCurrentLocation: false,
      facebookUrl: "https://facebook.com/alice",
      instagramUrl: "https://instagram.com/alice",
      websiteUrl: "https://alice.dev",
      youtubeUrl: "https://youtube.com/alice",
      showFacebook: true,
      showInstagram: false,
      showWebsite: true,
      showYoutube: false,
    });
  });

  it("returns null for non-existent user", async () => {
    const profile = await getUserProfile(db, "nonexistent");
    expect(profile).toBeNull();
  });
});

describe("getPublicProfile", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
    seedUser(db);
  });

  it("only returns social links where show* is true", async () => {
    const profile = await getPublicProfile(db, "u1");
    expect(profile).not.toBeNull();
    // showFacebook=true, showWebsite=true -> URLs present
    expect(profile!.facebookUrl).toBe("https://facebook.com/alice");
    expect(profile!.websiteUrl).toBe("https://alice.dev");
  });

  it("returns null URLs where show* is false", async () => {
    const profile = await getPublicProfile(db, "u1");
    expect(profile).not.toBeNull();
    // showInstagram=false, showYoutube=false -> null
    expect(profile!.instagramUrl).toBeNull();
    expect(profile!.youtubeUrl).toBeNull();
  });

  it("returns basic identity fields", async () => {
    const profile = await getPublicProfile(db, "u1");
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe("u1");
    expect(profile!.name).toBe("Alice");
  });

  it("does not expose email in public profile", async () => {
    const profile = await getPublicProfile(db, "u1");
    const json = JSON.stringify(profile);
    expect(json).not.toContain("alice@test.com");
    expect(json).not.toContain("email");
  });

  it("returns null for non-existent user", async () => {
    const profile = await getPublicProfile(db, "nonexistent");
    expect(profile).toBeNull();
  });
});

describe("updateUserProfile", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
    seedUser(db);
  });

  it("updates and persists profile fields", async () => {
    await updateUserProfile(db, "u1", {
      defaultRole: "Flyer",
      defaultShowName: false,
      facebookUrl: null,
      instagramUrl: "https://instagram.com/alice_new",
      websiteUrl: null,
      youtubeUrl: "https://youtube.com/alice_new",
      showFacebook: false,
      showInstagram: true,
      showWebsite: false,
      showYoutube: true,
    });

    const profile = await getUserProfile(db, "u1");
    expect(profile).not.toBeNull();
    expect(profile!.defaultRole).toBe("Flyer");
    expect(profile!.defaultShowName).toBe(false);
    expect(profile!.facebookUrl).toBeNull();
    expect(profile!.instagramUrl).toBe("https://instagram.com/alice_new");
    expect(profile!.websiteUrl).toBeNull();
    expect(profile!.youtubeUrl).toBe("https://youtube.com/alice_new");
    expect(profile!.showFacebook).toBe(false);
    expect(profile!.showInstagram).toBe(true);
    expect(profile!.showWebsite).toBe(false);
    expect(profile!.showYoutube).toBe(true);
  });

  it("public profile reflects updated show* flags", async () => {
    await updateUserProfile(db, "u1", {
      defaultRole: "Base",
      defaultShowName: true,
      facebookUrl: "https://facebook.com/alice",
      instagramUrl: "https://instagram.com/alice",
      websiteUrl: "https://alice.dev",
      youtubeUrl: "https://youtube.com/alice",
      showFacebook: false,
      showInstagram: true,
      showWebsite: false,
      showYoutube: true,
    });

    const pub = await getPublicProfile(db, "u1");
    expect(pub!.facebookUrl).toBeNull();
    expect(pub!.instagramUrl).toBe("https://instagram.com/alice");
    expect(pub!.websiteUrl).toBeNull();
    expect(pub!.youtubeUrl).toBe("https://youtube.com/alice");
  });
});

describe("validateProfileInput", () => {
  it("accepts valid data", () => {
    const result = validateProfileInput({
      defaultRole: "Hybrid",
      defaultShowName: true,
      facebookUrl: "https://facebook.com/me",
      instagramUrl: null,
      websiteUrl: "",
      youtubeUrl: "https://youtube.com/me",
      showFacebook: true,
      showInstagram: false,
      showWebsite: false,
      showYoutube: true,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.defaultRole).toBe("Hybrid");
      expect(result.data.defaultShowName).toBe(true);
      expect(result.data.facebookUrl).toBe("https://facebook.com/me");
      expect(result.data.instagramUrl).toBeNull();
      expect(result.data.websiteUrl).toBeNull(); // empty string becomes null
      expect(result.data.youtubeUrl).toBe("https://youtube.com/me");
      expect(result.data.showFacebook).toBe(true);
      expect(result.data.showInstagram).toBe(false);
      expect(result.data.showWebsite).toBe(false);
      expect(result.data.showYoutube).toBe(true);
    }
  });

  it("rejects invalid role", () => {
    const result = validateProfileInput({
      defaultRole: "Spotter",
      showFacebook: false,
      showInstagram: false,
      showWebsite: false,
      showYoutube: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "defaultRole")).toBe(true);
    }
  });

  it("rejects non-object body", () => {
    const result = validateProfileInput("not-an-object");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "body")).toBe(true);
    }
  });

  it("rejects null body", () => {
    const result = validateProfileInput(null);
    expect(result.valid).toBe(false);
  });

  it("boolean show fields default to false when omitted", () => {
    const result = validateProfileInput({
      defaultRole: "Base",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.showFacebook).toBe(false);
      expect(result.data.showInstagram).toBe(false);
      expect(result.data.showWebsite).toBe(false);
      expect(result.data.showYoutube).toBe(false);
    }
  });

  it("accepts null defaultRole and null defaultShowName", () => {
    const result = validateProfileInput({
      defaultRole: null,
      defaultShowName: null,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.defaultRole).toBeNull();
      expect(result.data.defaultShowName).toBeNull();
    }
  });

  it("accepts valid roles: Base, Flyer, Hybrid", () => {
    for (const role of ["Base", "Flyer", "Hybrid"]) {
      const result = validateProfileInput({ defaultRole: role });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.defaultRole).toBe(role);
      }
    }
  });
});

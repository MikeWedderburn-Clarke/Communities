import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb, resetDb } from "@/db/test-utils";
import * as schema from "@/db/schema";
import {
  getUserProfile,
  getPublicProfile,
  updateUserProfile,
  validateProfileInput,
  setRelationship,
  getRelationship,
  canViewSocialLinks,
} from "@/services/users";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function seedUsers(db: TestDb) {
  await db.insert(schema.users).values([
    {
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
      profileVisibility: "everyone",
    },
    {
      id: "u2",
      name: "Bob",
      email: "bob@test.com",
      isAdmin: false,
    },
    {
      id: "u3",
      name: "Carol",
      email: "carol@test.com",
      isAdmin: false,
    },
  ]);
}

describe("getUserProfile", () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await (db as any).$pglite?.close(); });
  beforeEach(async () => { await resetDb(db); await seedUsers(db); });

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
      lastLogin: null,
      facebookUrl: "https://facebook.com/alice",
      instagramUrl: "https://instagram.com/alice",
      websiteUrl: "https://alice.dev",
      youtubeUrl: "https://youtube.com/alice",
      profileVisibility: "everyone",
    });
  });

  it("returns null for non-existent user", async () => {
    const profile = await getUserProfile(db, "nonexistent");
    expect(profile).toBeNull();
  });
});

describe("getPublicProfile", () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await (db as any).$pglite?.close(); });
  beforeEach(async () => { await resetDb(db); await seedUsers(db); });

  it("returns social links when visibility is 'everyone'", async () => {
    const profile = await getPublicProfile(db, "u1", "u2");
    expect(profile!.facebookUrl).toBe("https://facebook.com/alice");
    expect(profile!.websiteUrl).toBe("https://alice.dev");
  });

  it("hides social links when visibility is 'followers' and viewer doesn't follow", async () => {
    await db.update(schema.users).set({ profileVisibility: "followers" }).where(schema.users.id.getSQL ? undefined as never : undefined).catch(() => {});
    // Use drizzle properly
    const { eq } = await import("drizzle-orm");
    await db.update(schema.users).set({ profileVisibility: "followers" }).where(eq(schema.users.id, "u1"));
    const profile = await getPublicProfile(db, "u1", "u2");
    expect(profile!.facebookUrl).toBeNull();
    expect(profile!.instagramUrl).toBeNull();
  });

  it("shows social links when visibility is 'followers' and viewer follows", async () => {
    const { eq } = await import("drizzle-orm");
    await db.update(schema.users).set({ profileVisibility: "followers" }).where(eq(schema.users.id, "u1"));
    await setRelationship(db, "u2", "u1", "following");
    const profile = await getPublicProfile(db, "u1", "u2");
    expect(profile!.facebookUrl).toBe("https://facebook.com/alice");
  });

  it("hides social links when visibility is 'friends' and viewer is not friend", async () => {
    const { eq } = await import("drizzle-orm");
    await db.update(schema.users).set({ profileVisibility: "friends" }).where(eq(schema.users.id, "u1"));
    const profile = await getPublicProfile(db, "u1", "u2");
    expect(profile!.facebookUrl).toBeNull();
  });

  it("shows social links when visibility is 'friends' and owner marked viewer as friend", async () => {
    const { eq } = await import("drizzle-orm");
    await db.update(schema.users).set({ profileVisibility: "friends" }).where(eq(schema.users.id, "u1"));
    await setRelationship(db, "u1", "u2", "friend");
    const profile = await getPublicProfile(db, "u1", "u2");
    expect(profile!.facebookUrl).toBe("https://facebook.com/alice");
  });

  it("returns basic identity fields", async () => {
    const profile = await getPublicProfile(db, "u1", "u2");
    expect(profile!.id).toBe("u1");
    expect(profile!.name).toBe("Alice");
  });

  it("does not expose email in public profile", async () => {
    const profile = await getPublicProfile(db, "u1", "u2");
    const json = JSON.stringify(profile);
    expect(json).not.toContain("alice@test.com");
    expect(json).not.toContain("email");
  });

  it("returns null for non-existent user", async () => {
    const profile = await getPublicProfile(db, "nonexistent", "u2");
    expect(profile).toBeNull();
  });

  it("includes viewer relationship in response", async () => {
    await setRelationship(db, "u2", "u1", "following");
    const profile = await getPublicProfile(db, "u1", "u2");
    expect(profile!.viewerRelationship).toBe("following");
  });

  it("viewerRelationship is null when no relationship", async () => {
    const profile = await getPublicProfile(db, "u1", "u2");
    expect(profile!.viewerRelationship).toBeNull();
  });
});

describe("updateUserProfile", () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await (db as any).$pglite?.close(); });
  beforeEach(async () => { await resetDb(db); await seedUsers(db); });

  it("updates and persists profile fields including profileVisibility", async () => {
    await updateUserProfile(db, "u1", {
      defaultRole: "Flyer",
      defaultShowName: false,
      facebookUrl: null,
      instagramUrl: "https://instagram.com/alice_new",
      websiteUrl: null,
      youtubeUrl: "https://youtube.com/alice_new",
      profileVisibility: "followers",
      homeCity: null,
      useCurrentLocation: false,
    });

    const profile = await getUserProfile(db, "u1");
    expect(profile!.defaultRole).toBe("Flyer");
    expect(profile!.facebookUrl).toBeNull();
    expect(profile!.instagramUrl).toBe("https://instagram.com/alice_new");
    expect(profile!.profileVisibility).toBe("followers");
  });
});

describe("validateProfileInput", () => {
  it("accepts valid data with profileVisibility", () => {
    const result = validateProfileInput({
      defaultRole: "Hybrid",
      defaultShowName: true,
      facebookUrl: "https://facebook.com/me",
      instagramUrl: null,
      websiteUrl: "",
      youtubeUrl: "https://youtube.com/me",
      profileVisibility: "friends",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.profileVisibility).toBe("friends");
    }
  });

  it("profileVisibility defaults to 'everyone' when omitted", () => {
    const result = validateProfileInput({ defaultRole: "Base" });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.profileVisibility).toBe("everyone");
    }
  });

  it("rejects invalid profileVisibility", () => {
    const result = validateProfileInput({ profileVisibility: "nobody" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "profileVisibility")).toBe(true);
    }
  });

  it("rejects invalid role", () => {
    const result = validateProfileInput({ defaultRole: "Spotter" });
    expect(result.valid).toBe(false);
  });

  it("rejects non-object body", () => {
    const result = validateProfileInput("not-an-object");
    expect(result.valid).toBe(false);
  });

  it("rejects null body", () => {
    const result = validateProfileInput(null);
    expect(result.valid).toBe(false);
  });
});

describe("relationships", () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await (db as any).$pglite?.close(); });
  beforeEach(async () => { await resetDb(db); await seedUsers(db); });

  it("creates a following relationship", async () => {
    await setRelationship(db, "u1", "u2", "following");
    expect(await getRelationship(db, "u1", "u2")).toBe("following");
  });

  it("creates a friend relationship", async () => {
    await setRelationship(db, "u1", "u2", "friend");
    expect(await getRelationship(db, "u1", "u2")).toBe("friend");
  });

  it("returns null when no relationship exists", async () => {
    expect(await getRelationship(db, "u1", "u2")).toBeNull();
  });

  it("updates relationship type", async () => {
    await setRelationship(db, "u1", "u2", "following");
    await setRelationship(db, "u1", "u2", "friend");
    expect(await getRelationship(db, "u1", "u2")).toBe("friend");
  });

  it("removes relationship when type is null", async () => {
    await setRelationship(db, "u1", "u2", "following");
    await setRelationship(db, "u1", "u2", null);
    expect(await getRelationship(db, "u1", "u2")).toBeNull();
  });

  it("relationships are directional", async () => {
    await setRelationship(db, "u1", "u2", "following");
    expect(await getRelationship(db, "u1", "u2")).toBe("following");
    expect(await getRelationship(db, "u2", "u1")).toBeNull();
  });
});

describe("canViewSocialLinks", () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await (db as any).$pglite?.close(); });
  beforeEach(async () => { await resetDb(db); await seedUsers(db); });

  it("returns true for 'everyone' visibility", async () => {
    expect(await canViewSocialLinks(db, "u1", "everyone", "u2")).toBe(true);
  });

  it("returns false for anonymous viewers", async () => {
    expect(await canViewSocialLinks(db, "u1", "everyone", null)).toBe(false);
  });

  it("returns true when viewing own profile", async () => {
    expect(await canViewSocialLinks(db, "u1", "friends", "u1")).toBe(true);
  });

  it("returns true for 'followers' when viewer follows owner", async () => {
    await setRelationship(db, "u2", "u1", "following");
    expect(await canViewSocialLinks(db, "u1", "followers", "u2")).toBe(true);
  });

  it("returns false for 'followers' when viewer does not follow", async () => {
    expect(await canViewSocialLinks(db, "u1", "followers", "u2")).toBe(false);
  });

  it("returns true for 'friends' when owner marked viewer as friend", async () => {
    await setRelationship(db, "u1", "u2", "friend");
    expect(await canViewSocialLinks(db, "u1", "friends", "u2")).toBe(true);
  });

  it("returns false for 'friends' when owner has not marked viewer", async () => {
    expect(await canViewSocialLinks(db, "u1", "friends", "u2")).toBe(false);
  });
});

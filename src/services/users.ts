import { eq, and, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import type { UserProfile, PublicProfile, Role, RelationshipType, ProfileVisibility } from "@/types";
import { ROLES, PROFILE_VISIBILITY_TIERS } from "@/types";

// ── Profile queries ──────────────────────────────────────────────

export async function getUserProfile(db: Db, userId: string): Promise<UserProfile | null> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isTeacherApproved: user.isTeacherApproved,
    teacherRequestedAt: user.teacherRequestedAt ?? null,
    defaultRole: (user.defaultRole as Role) ?? null,
    defaultShowName: user.defaultShowName ?? null,
    facebookUrl: user.facebookUrl ?? null,
    instagramUrl: user.instagramUrl ?? null,
    websiteUrl: user.websiteUrl ?? null,
    youtubeUrl: user.youtubeUrl ?? null,
    profileVisibility: (user.profileVisibility ?? "everyone") as ProfileVisibility,
    homeCity: user.homeCity ?? null,
    useCurrentLocation: user.useCurrentLocation,
    lastLogin: user.lastLogin ?? null,
  };
}

export async function getPublicProfile(
  db: Db,
  userId: string,
  viewerId: string | null = null
): Promise<PublicProfile | null> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) return null;

  const visibility = (user.profileVisibility ?? "everyone") as ProfileVisibility;
  const canView = await canViewSocialLinks(db, userId, visibility, viewerId);

  let viewerRelationship: RelationshipType | null = null;
  if (viewerId && viewerId !== userId) {
    viewerRelationship = await getRelationship(db, viewerId, userId);
  }

  return {
    id: user.id,
    name: user.name,
    facebookUrl: canView ? (user.facebookUrl ?? null) : null,
    instagramUrl: canView ? (user.instagramUrl ?? null) : null,
    websiteUrl: canView ? (user.websiteUrl ?? null) : null,
    youtubeUrl: canView ? (user.youtubeUrl ?? null) : null,
    viewerRelationship,
  };
}

// ── Profile updates ──────────────────────────────────────────────

interface ProfileUpdateData {
  defaultRole: Role | null;
  defaultShowName: boolean | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  youtubeUrl: string | null;
  profileVisibility: ProfileVisibility;
  homeCity: string | null;
  useCurrentLocation: boolean;
}

export async function updateUserProfile(db: Db, userId: string, data: ProfileUpdateData): Promise<void> {
  await db
    .update(schema.users)
    .set({
      defaultRole: data.defaultRole,
      defaultShowName: data.defaultShowName,
      facebookUrl: data.facebookUrl,
      instagramUrl: data.instagramUrl,
      websiteUrl: data.websiteUrl,
      youtubeUrl: data.youtubeUrl,
      profileVisibility: data.profileVisibility,
      homeCity: data.homeCity,
      useCurrentLocation: data.useCurrentLocation,
    })
    .where(eq(schema.users.id, userId));
}

export async function recordLastLogin(db: Db, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({
      previousLogin: sql`last_login`,
      lastLogin: new Date().toISOString(),
    })
    .where(eq(schema.users.id, userId));
}

// ── Validation ───────────────────────────────────────────────────

interface ValidationError {
  field: string;
  message: string;
}

export function validateProfileInput(
  body: unknown
): { valid: true; data: ProfileUpdateData } | { valid: false; errors: ValidationError[] } {
  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: [{ field: "body", message: "Body must be a JSON object" }] };
  }

  const obj = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  // defaultRole: optional, must be valid role or null
  let defaultRole: Role | null = null;
  if (obj.defaultRole !== undefined && obj.defaultRole !== null) {
    if (typeof obj.defaultRole !== "string" || !(ROLES as readonly string[]).includes(obj.defaultRole)) {
      errors.push({ field: "defaultRole", message: `Must be one of: ${ROLES.join(", ")}` });
    } else {
      defaultRole = obj.defaultRole as Role;
    }
  }

  // defaultShowName: optional, must be boolean or null
  let defaultShowName: boolean | null = null;
  if (obj.defaultShowName !== undefined && obj.defaultShowName !== null) {
    if (typeof obj.defaultShowName !== "boolean") {
      errors.push({ field: "defaultShowName", message: "Must be a boolean" });
    } else {
      defaultShowName = obj.defaultShowName;
    }
  }

  // Social URLs: optional strings, must use http(s) if present
  const urlFields = ["facebookUrl", "instagramUrl", "websiteUrl", "youtubeUrl"] as const;
  const urls: Record<string, string | null> = {};
  for (const field of urlFields) {
    if (obj[field] !== undefined && obj[field] !== null && obj[field] !== "") {
      if (typeof obj[field] !== "string") {
        errors.push({ field, message: "Must be a string" });
      } else {
        const trimmed = (obj[field] as string).trim();
        if (!/^https?:\/\//i.test(trimmed)) {
          errors.push({ field, message: "Must be a valid URL starting with https://" });
        } else {
          urls[field] = trimmed;
        }
      }
    } else {
      urls[field] = null;
    }
  }

  // profileVisibility: optional, defaults to "everyone"
  let profileVisibility: ProfileVisibility = "everyone";
  if (obj.profileVisibility !== undefined && obj.profileVisibility !== null) {
    if (!(PROFILE_VISIBILITY_TIERS as readonly string[]).includes(obj.profileVisibility as string)) {
      errors.push({ field: "profileVisibility", message: `Must be one of: ${PROFILE_VISIBILITY_TIERS.join(", ")}` });
    } else {
      profileVisibility = obj.profileVisibility as ProfileVisibility;
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // homeCity: optional string or null
  let homeCity: string | null = null;
  if (obj.homeCity !== undefined && obj.homeCity !== null && obj.homeCity !== "") {
    if (typeof obj.homeCity !== "string") {
      errors.push({ field: "homeCity", message: "Must be a string" });
    } else {
      homeCity = (obj.homeCity as string).trim();
    }
  }

  // useCurrentLocation: optional boolean, default false
  let useCurrentLocation = false;
  if (obj.useCurrentLocation !== undefined) {
    if (typeof obj.useCurrentLocation !== "boolean") {
      errors.push({ field: "useCurrentLocation", message: "Must be a boolean" });
    } else {
      useCurrentLocation = obj.useCurrentLocation;
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      defaultRole,
      defaultShowName,
      facebookUrl: urls.facebookUrl ?? null,
      instagramUrl: urls.instagramUrl ?? null,
      websiteUrl: urls.websiteUrl ?? null,
      youtubeUrl: urls.youtubeUrl ?? null,
      profileVisibility,
      homeCity,
      useCurrentLocation,
    },
  };
}

// ── Relationships ────────────────────────────────────────────────

export async function setRelationship(
  db: Db,
  userId: string,
  targetUserId: string,
  type: RelationshipType | null
): Promise<void> {
  if (type === null) {
    await db
      .delete(schema.userRelationships)
      .where(
        and(
          eq(schema.userRelationships.userId, userId),
          eq(schema.userRelationships.targetUserId, targetUserId)
        )
      );
    return;
  }

  const id = `rel-${crypto.randomUUID()}`;
  await db
    .insert(schema.userRelationships)
    .values({ id, userId, targetUserId, type, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: [schema.userRelationships.userId, schema.userRelationships.targetUserId],
      set: { type, createdAt: new Date().toISOString() },
    });
}

export async function getRelationship(
  db: Db,
  userId: string,
  targetUserId: string
): Promise<RelationshipType | null> {
  const [row] = await db
    .select({ type: schema.userRelationships.type })
    .from(schema.userRelationships)
    .where(
      and(
        eq(schema.userRelationships.userId, userId),
        eq(schema.userRelationships.targetUserId, targetUserId)
      )
    )
    .limit(1);
  return (row?.type as RelationshipType) ?? null;
}

export async function getOutgoingRelationships(
  db: Db,
  userId: string
): Promise<{ targetUserId: string; targetName: string; type: RelationshipType }[]> {
  const rows = await db
    .select({
      targetUserId: schema.userRelationships.targetUserId,
      targetName: schema.users.name,
      type: schema.userRelationships.type,
    })
    .from(schema.userRelationships)
    .innerJoin(schema.users, eq(schema.userRelationships.targetUserId, schema.users.id))
    .where(eq(schema.userRelationships.userId, userId));
  return rows.map((r) => ({ targetUserId: r.targetUserId, targetName: r.targetName, type: r.type as RelationshipType }));
}

export async function getFollowers(
  db: Db,
  userId: string
): Promise<{ userId: string; userName: string; type: RelationshipType }[]> {
  const rows = await db
    .select({
      userId: schema.userRelationships.userId,
      userName: schema.users.name,
      type: schema.userRelationships.type,
    })
    .from(schema.userRelationships)
    .innerJoin(schema.users, eq(schema.userRelationships.userId, schema.users.id))
    .where(eq(schema.userRelationships.targetUserId, userId));
  return rows.map((r) => ({ userId: r.userId, userName: r.userName, type: r.type as RelationshipType }));
}

// ── Visibility helpers ───────────────────────────────────────────

export async function canViewSocialLinks(
  db: Db,
  ownerId: string,
  ownerVisibility: ProfileVisibility,
  viewerId: string | null
): Promise<boolean> {
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;
  if (ownerVisibility === "everyone") return true;

  if (ownerVisibility === "followers") {
    const rel = await getRelationship(db, viewerId, ownerId);
    return rel === "following" || rel === "friend";
  }

  if (ownerVisibility === "friends") {
    const rel = await getRelationship(db, ownerId, viewerId);
    return rel === "friend";
  }

  return false;
}

export async function batchCanViewSocialLinks(
  db: Db,
  attendees: { userId: string; profileVisibility: string }[],
  viewerId: string | null,
  isAdmin: boolean
): Promise<Set<string>> {
  const canView = new Set<string>();
  if (isAdmin) {
    for (const a of attendees) canView.add(a.userId);
    return canView;
  }
  if (!viewerId) return canView;

  const followerIds: string[] = [];
  const friendIds: string[] = [];
  for (const a of attendees) {
    if (a.userId === viewerId) {
      canView.add(a.userId);
      continue;
    }
    const vis = (a.profileVisibility ?? "everyone") as ProfileVisibility;
    if (vis === "everyone") {
      canView.add(a.userId);
    } else if (vis === "followers") {
      followerIds.push(a.userId);
    } else if (vis === "friends") {
      friendIds.push(a.userId);
    }
  }

  if (followerIds.length > 0) {
    const fwd = await db
      .select({ targetUserId: schema.userRelationships.targetUserId })
      .from(schema.userRelationships)
      .where(and(
        eq(schema.userRelationships.userId, viewerId),
        sql`${schema.userRelationships.targetUserId} IN (${sql.join(followerIds.map(id => sql`${id}`), sql`, `)})`
      ));
    for (const r of fwd) canView.add(r.targetUserId);
  }

  if (friendIds.length > 0) {
    const rev = await db
      .select({ userId: schema.userRelationships.userId })
      .from(schema.userRelationships)
      .where(and(
        eq(schema.userRelationships.targetUserId, viewerId),
        eq(schema.userRelationships.type, "friend"),
        sql`${schema.userRelationships.userId} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)})`
      ));
    for (const r of rev) canView.add(r.userId);
  }

  return canView;
}

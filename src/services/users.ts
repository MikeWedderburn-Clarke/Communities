import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import type { UserProfile, PublicProfile, Role } from "@/types";
import { ROLES } from "@/types";

type Db = BetterSQLite3Database<typeof schema>;

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
    showFacebook: user.showFacebook,
    showInstagram: user.showInstagram,
    showWebsite: user.showWebsite,
    showYoutube: user.showYoutube,
  };
}

export async function getPublicProfile(db: Db, userId: string): Promise<PublicProfile | null> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    facebookUrl: user.showFacebook ? (user.facebookUrl ?? null) : null,
    instagramUrl: user.showInstagram ? (user.instagramUrl ?? null) : null,
    websiteUrl: user.showWebsite ? (user.websiteUrl ?? null) : null,
    youtubeUrl: user.showYoutube ? (user.youtubeUrl ?? null) : null,
  };
}

interface ProfileUpdateData {
  defaultRole: Role | null;
  defaultShowName: boolean | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  youtubeUrl: string | null;
  showFacebook: boolean;
  showInstagram: boolean;
  showWebsite: boolean;
  showYoutube: boolean;
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
      showFacebook: data.showFacebook,
      showInstagram: data.showInstagram,
      showWebsite: data.showWebsite,
      showYoutube: data.showYoutube,
    })
    .where(eq(schema.users.id, userId));
}

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

  // Social URLs: optional strings
  const urlFields = ["facebookUrl", "instagramUrl", "websiteUrl", "youtubeUrl"] as const;
  const urls: Record<string, string | null> = {};
  for (const field of urlFields) {
    if (obj[field] !== undefined && obj[field] !== null && obj[field] !== "") {
      if (typeof obj[field] !== "string") {
        errors.push({ field, message: "Must be a string" });
      } else {
        urls[field] = (obj[field] as string).trim();
      }
    } else {
      urls[field] = null;
    }
  }

  // Visibility booleans: default to false
  const showFields = ["showFacebook", "showInstagram", "showWebsite", "showYoutube"] as const;
  const shows: Record<string, boolean> = {};
  for (const field of showFields) {
    if (obj[field] !== undefined) {
      if (typeof obj[field] !== "boolean") {
        errors.push({ field, message: "Must be a boolean" });
      } else {
        shows[field] = obj[field] as boolean;
      }
    } else {
      shows[field] = false;
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
      showFacebook: shows.showFacebook ?? false,
      showInstagram: shows.showInstagram ?? false,
      showWebsite: shows.showWebsite ?? false,
      showYoutube: shows.showYoutube ?? false,
    },
  };
}

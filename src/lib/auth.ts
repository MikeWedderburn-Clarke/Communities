import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SessionUser } from "@/types";

/** Get the currently logged-in user from the NextAuth session, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    isTeacherApproved: user.isTeacherApproved,
    defaultRole: (user.defaultRole as SessionUser["defaultRole"]) ?? null,
    defaultShowName: user.defaultShowName ?? null,
    homeCity: user.homeCity ?? null,
    useCurrentLocation: user.useCurrentLocation,
    lastLogin: user.lastLogin ?? null,
    freshSince: user.previousLogin ?? null,
  };
}

/** List all available mock users (shown on the login picker in dev). */
export async function getMockUsers(): Promise<SessionUser[]> {
  const rows = await db.select().from(users);
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    isTeacherApproved: u.isTeacherApproved,
    defaultRole: (u.defaultRole as SessionUser["defaultRole"]) ?? null,
    defaultShowName: u.defaultShowName ?? null,
    homeCity: u.homeCity ?? null,
    useCurrentLocation: u.useCurrentLocation,
    lastLogin: u.lastLogin ?? null,
    freshSince: u.previousLogin ?? null,
  }));
}

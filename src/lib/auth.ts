/**
 * Mock authentication layer.
 *
 * TODO: Replace with real auth (e.g. NextAuth.js with email magic-link provider)
 *       before production deployment.
 *
 * This module provides cookie-based session management using a simple
 * JSON cookie. In production, use signed/encrypted sessions or JWTs.
 */

import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SessionUser } from "@/types";

const SESSION_COOKIE = "session_user_id";

/** Get the currently logged-in user, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email };
}

/** Set the session cookie to log in as a user. */
export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

/** Clear the session cookie to log out. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** List all available mock users (for the login picker). */
export async function getMockUsers(): Promise<SessionUser[]> {
  const rows = await db.select().from(users);
  return rows.map((u) => ({ id: u.id, name: u.name, email: u.email }));
}

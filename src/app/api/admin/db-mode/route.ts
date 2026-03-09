import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";

/**
 * POST /api/admin/db-mode
 * Body: { mode: "test" | "live" }
 * Admin-only. Sets the `db_mode` cookie to switch between live and test databases.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = (body as { mode?: unknown }).mode;
  if (mode !== "test" && mode !== "live") {
    return NextResponse.json({ error: "mode must be 'test' or 'live'" }, { status: 400 });
  }

  const cookieStore = await cookies();
  if (mode === "test") {
    cookieStore.set("db_mode", "test", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // No maxAge — session cookie only; cleared when browser closes.
    });
  } else {
    cookieStore.delete("db_mode");
  }

  return NextResponse.json({ mode });
}

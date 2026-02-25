import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { approveTeacher, denyTeacher } from "@/services/events";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).userId !== "string" ||
    !(body as Record<string, string>).userId
  ) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const action = (body as Record<string, unknown>).action;
  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "action must be \"approve\" or \"deny\"" }, { status: 400 });
  }

  if (action === "approve") {
    await approveTeacher(db, (body as Record<string, string>).userId, user.id);
  } else {
    await denyTeacher(db, (body as Record<string, string>).userId);
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import { createEventGroup, listEventGroups } from "@/services/event-groups";
import { validateCreateEventGroupInput } from "@/services/validation";

export async function GET() {
  const db = await getDb();
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }
  const groups = await listEventGroups(db, true);
  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
  const db = await getDb();
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

  const result = validateCreateEventGroupInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: "Validation failed", details: result.errors }, { status: 400 });
  }

  const groupId = await createEventGroup(db, result.data, user.id);
  return NextResponse.json({ ok: true, groupId });
}

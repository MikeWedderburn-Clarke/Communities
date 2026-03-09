import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import { addEventToGroup } from "@/services/event-groups";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb();
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const { id: groupId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  if (typeof obj.eventId !== "string" || obj.eventId.trim() === "") {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const sortOrder = typeof obj.sortOrder === "number" ? obj.sortOrder : 0;

  await addEventToGroup(db, groupId, obj.eventId.trim(), sortOrder);
  return NextResponse.json({ ok: true });
}

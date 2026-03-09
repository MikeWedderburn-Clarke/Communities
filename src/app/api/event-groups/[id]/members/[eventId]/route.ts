import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import { removeEventFromGroup } from "@/services/event-groups";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const db = await getDb();
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const { id: groupId, eventId } = await params;
  await removeEventFromGroup(db, groupId, eventId);
  return NextResponse.json({ ok: true });
}

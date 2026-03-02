import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { getEventGroupById, updateEventGroup, publishEventGroup } from "@/services/event-groups";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  const includeUnpublished = user?.isAdmin ?? false;

  const group = await getEventGroupById(db, id, includeUnpublished);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  return NextResponse.json({ group });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;

  // Handle publish action
  if (obj.action === "publish") {
    try {
      await publishEventGroup(db, id);
      return NextResponse.json({ ok: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to publish group";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Otherwise update fields
  const patch: Record<string, unknown> = {};
  if (typeof obj.name === "string") patch.name = obj.name.trim();
  if (obj.description !== undefined) patch.description = typeof obj.description === "string" ? obj.description.trim() || null : null;
  if (obj.status === "draft" || obj.status === "published") patch.status = obj.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await updateEventGroup(db, id, patch as Parameters<typeof updateEventGroup>[2]);
  return NextResponse.json({ ok: true });
}

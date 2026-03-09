import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import { updateTicketType } from "@/services/ticket-types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb();
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
  const patch: Record<string, unknown> = {};

  if (typeof obj.name === "string") patch.name = obj.name.trim();
  if (obj.description !== undefined) patch.description = typeof obj.description === "string" ? obj.description.trim() || null : null;
  if (typeof obj.costAmount === "number" && obj.costAmount >= 0) patch.costAmount = obj.costAmount;
  if (typeof obj.costCurrency === "string") patch.costCurrency = obj.costCurrency.trim().toUpperCase();
  if (obj.concessionAmount === null || (typeof obj.concessionAmount === "number" && obj.concessionAmount >= 0)) {
    patch.concessionAmount = obj.concessionAmount;
  }
  if (obj.capacity === null || (typeof obj.capacity === "number" && Number.isInteger(obj.capacity) && obj.capacity > 0)) {
    patch.capacity = obj.capacity;
  }
  if (typeof obj.isAvailable === "boolean") patch.isAvailable = obj.isAvailable;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await updateTicketType(db, id, patch as Parameters<typeof updateTicketType>[2]);
  return NextResponse.json({ ok: true });
}

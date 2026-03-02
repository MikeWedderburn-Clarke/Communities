import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { createTicketType } from "@/services/ticket-types";
import { validateCreateTicketTypeInput } from "@/services/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Inject groupId from URL into the body before validation
  const bodyWithGroup = { ...(body as Record<string, unknown>), groupId };

  const result = validateCreateTicketTypeInput(bodyWithGroup);
  if (!result.valid) {
    return NextResponse.json({ error: "Validation failed", details: result.errors }, { status: 400 });
  }

  try {
    const ticketTypeId = await createTicketType(db, result.data);
    return NextResponse.json({ ok: true, ticketTypeId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create ticket type";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

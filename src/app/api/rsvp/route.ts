import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { createOrUpdateRsvp, deleteRsvp, getEventById } from "@/services/events";
import { validateRsvpInput } from "@/services/validation";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validateRsvpInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: "Validation failed", details: result.errors }, { status: 400 });
  }

  const { eventId, role, showName } = result.data;

  // Verify event exists
  const event = await getEventById(db, eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await createOrUpdateRsvp(db, user.id, eventId, role, showName);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).eventId !== "string") {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const eventId = (body as Record<string, string>).eventId;
  const deleted = await deleteRsvp(db, user.id, eventId);

  if (!deleted) {
    return NextResponse.json({ error: "RSVP not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import { toggleInterest, getEventById, getUserRsvpMap } from "@/services/events";
import { validateInterestInput } from "@/services/validation";

export async function POST(request: NextRequest) {
  const db = await getDb();
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

  const result = validateInterestInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: "Validation failed", details: result.errors }, { status: 400 });
  }

  const { eventId } = result.data;

  // Verify event exists
  const event = await getEventById(db, eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Prevent toggling interest when user already has an RSVP
  const rsvpMap = await getUserRsvpMap(db, user.id);
  if (rsvpMap[eventId]) {
    return NextResponse.json(
      { error: "You are already going to this event. Cancel your RSVP first to mark as interested." },
      { status: 409 }
    );
  }

  const { interested } = await toggleInterest(db, user.id, eventId);

  return NextResponse.json({ ok: true, interested });
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { createEvent } from "@/services/events";
import { validateEventInput } from "@/services/validation";

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

  const result = validateEventInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: "Validation failed", details: result.errors }, { status: 400 });
  }

  const eventId = await createEvent(db, result.data, user.id, user.isAdmin);

  return NextResponse.json({
    ok: true,
    eventId,
    status: user.isAdmin ? "approved" : "pending",
    message: user.isAdmin
      ? "Event created and published."
      : "Event submitted for admin review.",
  });
}

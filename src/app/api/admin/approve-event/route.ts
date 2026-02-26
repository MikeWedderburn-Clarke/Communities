import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { approveEvent, rejectEvent, getEventById } from "@/services/events";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  const eventId = obj.eventId;
  const action = obj.action;

  if (typeof eventId !== "string" || eventId.trim() === "") {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const event = await getEventById(db, eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (action === "approve") {
    await approveEvent(db, eventId);
  } else {
    await rejectEvent(db, eventId);
  }

  return NextResponse.json({ ok: true, action });
}

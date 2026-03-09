import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import { createBooking, getBookingsForUser } from "@/services/bookings";
import { validateCreateBookingInput } from "@/services/validation";

export async function GET(request: NextRequest) {
  const db = await getDb();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId") ?? undefined;

  const bookings = await getBookingsForUser(db, user.id, groupId);
  return NextResponse.json({ bookings });
}

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

  const result = validateCreateBookingInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: "Validation failed", details: result.errors }, { status: 400 });
  }

  try {
    const bookingId = await createBooking(db, user.id, result.data);
    return NextResponse.json({ ok: true, bookingId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create booking";
    // Sold out and already-booked are user-facing 409s
    if (message.includes("sold out") || message.includes("Already booked")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("not currently available")) {
      return NextResponse.json({ error: message }, { status: 410 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

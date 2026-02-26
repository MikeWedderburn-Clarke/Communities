import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { searchLocations, getAllLocations, createLocation } from "@/services/locations";
import { validateLocationInput } from "@/services/validation";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  const locations = q
    ? await searchLocations(db, q)
    : await getAllLocations(db);

  return NextResponse.json(locations);
}

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

  const result = validateLocationInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: "Validation failed", details: result.errors }, { status: 400 });
  }

  try {
    const locationId = await createLocation(db, result.data, user.id);
    return NextResponse.json({ ok: true, locationId });
  } catch (err: unknown) {
    // Handle unique constraint violation
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "A location with this name, city, and country already exists" },
        { status: 409 },
      );
    }
    throw err;
  }
}

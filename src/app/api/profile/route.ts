import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { validateProfileInput, updateUserProfile } from "@/services/users";

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const result = validateProfileInput(body);
  if (!result.valid) {
    return NextResponse.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  await updateUserProfile(db, user.id, result.data);

  return NextResponse.json({ ok: true });
}

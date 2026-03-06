import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { setRelationship, getRelationship } from "@/services/users";
import { RELATIONSHIP_TYPES } from "@/types";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const targetUserId = request.nextUrl.searchParams.get("targetUserId");
  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }

  const type = await getRelationship(db, user.id, targetUserId);
  return NextResponse.json({ type });
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

  const obj = body as Record<string, unknown>;
  const targetUserId = typeof obj.targetUserId === "string" ? obj.targetUserId.trim() : "";
  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot set relationship to yourself" }, { status: 400 });
  }

  // type: null to remove, "following" or "friend" to set
  let type: string | null = null;
  if (obj.type !== undefined && obj.type !== null) {
    if (!(RELATIONSHIP_TYPES as readonly string[]).includes(obj.type as string)) {
      return NextResponse.json(
        { error: `type must be one of: ${RELATIONSHIP_TYPES.join(", ")} or null` },
        { status: 400 }
      );
    }
    type = obj.type as string;
  }

  await setRelationship(db, user.id, targetUserId, type as any);
  return NextResponse.json({ ok: true, type });
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { getTeacherSplitsForGroup, setTeacherSplit } from "@/services/teacher-splits";
import { validateSetTeacherSplitInput } from "@/services/validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const { id: groupId } = await params;
  const splits = await getTeacherSplitsForGroup(db, groupId);
  return NextResponse.json({ splits });
}

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

  const result = validateSetTeacherSplitInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: "Validation failed", details: result.errors }, { status: 400 });
  }

  try {
    await setTeacherSplit(db, result.data);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to set teacher split";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

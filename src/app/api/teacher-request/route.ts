import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import { requestTeacherStatus } from "@/services/events";

export async function POST(_request: NextRequest) {
  const db = await getDb();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (user.isTeacherApproved) {
    return NextResponse.json({ error: "You are already an approved teacher" }, { status: 400 });
  }

  await requestTeacherStatus(db, user.id);

  return NextResponse.json({ ok: true });
}

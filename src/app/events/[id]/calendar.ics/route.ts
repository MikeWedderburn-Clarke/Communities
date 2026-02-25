import { NextResponse } from "next/server";
import { db } from "@/db";
import { getEventById } from "@/services/events";
import { generateIcs } from "@/services/ics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await getEventById(db, id);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const ics = generateIcs({
    id: event.id,
    title: event.title,
    description: event.description,
    dateTime: event.dateTime,
    endDateTime: event.endDateTime,
    location: event.location,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.id}.ics"`,
    },
  });
}

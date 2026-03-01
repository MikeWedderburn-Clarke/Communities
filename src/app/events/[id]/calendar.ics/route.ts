import { NextResponse } from "next/server";
import { db } from "@/db";
import { getEventDetail } from "@/services/events";
import { generateIcs } from "@/services/ics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await getEventDetail(db, id, null);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const occurrence = event.nextOccurrence ?? { dateTime: event.dateTime, endDateTime: event.endDateTime };

  const ics = generateIcs({
    id: event.id,
    title: event.title,
    description: event.description,
    dateTime: occurrence.dateTime,
    endDateTime: occurrence.endDateTime,
    location: `${event.location.name}, ${event.location.city}, ${event.location.country}`,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.id}.ics"`,
    },
  });
}

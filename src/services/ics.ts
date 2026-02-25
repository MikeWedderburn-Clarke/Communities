/** Generate an iCalendar (.ics) string for a single event. No external deps. */
export function generateIcs(event: {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  endDateTime: string;
  location: string;
}): string {
  const dtStart = toIcsDate(event.dateTime);
  const dtEnd = toIcsDate(event.endDateTime);
  const now = toIcsDate(new Date().toISOString());
  const uid = `${event.id}@acroyoga-community`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AcroYoga Community//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Convert ISO-8601 date string to iCalendar UTC format (YYYYMMDDTHHMMSSZ). */
function toIcsDate(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d+/, "");
}

/** Escape special characters in iCalendar text values. */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

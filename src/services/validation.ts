import { ROLES, RECURRENCE_FREQUENCIES, type Role, type CreateEventInput, type CreateLocationInput, type RecurrenceRule } from "@/types";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateRsvpInput(body: unknown): {
  valid: true;
  data: { eventId: string; role: Role; showName: boolean; isTeaching: boolean };
} | {
  valid: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.eventId !== "string" || obj.eventId.trim() === "") {
    errors.push({ field: "eventId", message: "eventId is required and must be a non-empty string" });
  }

  if (typeof obj.role !== "string" || !(ROLES as readonly string[]).includes(obj.role)) {
    errors.push({ field: "role", message: `role must be one of: ${ROLES.join(", ")}` });
  }

  if (typeof obj.showName !== "boolean") {
    errors.push({ field: "showName", message: "showName must be a boolean" });
  }

  if (obj.isTeaching !== undefined && typeof obj.isTeaching !== "boolean") {
    errors.push({ field: "isTeaching", message: "isTeaching must be a boolean" });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      eventId: (obj.eventId as string).trim(),
      role: obj.role as Role,
      showName: obj.showName as boolean,
      isTeaching: (obj.isTeaching as boolean) ?? false,
    },
  };
}

export function validateEventInput(body: unknown): {
  valid: true;
  data: CreateEventInput;
} | {
  valid: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.title !== "string" || obj.title.trim() === "") {
    errors.push({ field: "title", message: "title is required and must be a non-empty string" });
  } else if (obj.title.trim().length > 200) {
    errors.push({ field: "title", message: "title must be 200 characters or less" });
  }

  if (typeof obj.description !== "string" || obj.description.trim() === "") {
    errors.push({ field: "description", message: "description is required and must be a non-empty string" });
  } else if (obj.description.trim().length > 5000) {
    errors.push({ field: "description", message: "description must be 5000 characters or less" });
  }

  if (typeof obj.dateTime !== "string" || obj.dateTime.trim() === "") {
    errors.push({ field: "dateTime", message: "dateTime is required (ISO-8601)" });
  } else if (isNaN(Date.parse(obj.dateTime))) {
    errors.push({ field: "dateTime", message: "dateTime must be a valid ISO-8601 date string" });
  }

  if (typeof obj.endDateTime !== "string" || obj.endDateTime.trim() === "") {
    errors.push({ field: "endDateTime", message: "endDateTime is required (ISO-8601)" });
  } else if (isNaN(Date.parse(obj.endDateTime))) {
    errors.push({ field: "endDateTime", message: "endDateTime must be a valid ISO-8601 date string" });
  }

  const startDate = typeof obj.dateTime === "string" && !isNaN(Date.parse(obj.dateTime)) ? new Date(obj.dateTime) : null;
  const endDate = typeof obj.endDateTime === "string" && !isNaN(Date.parse(obj.endDateTime)) ? new Date(obj.endDateTime) : null;

  // Cross-field: end must be after start
  if (startDate && endDate && endDate <= startDate) {
    errors.push({ field: "endDateTime", message: "endDateTime must be after dateTime" });
  }

  if (typeof obj.locationId !== "string" || obj.locationId.trim() === "") {
    errors.push({ field: "locationId", message: "locationId is required and must be a non-empty string" });
  }

  let recurrence: RecurrenceRule | null = null;
  if (obj.recurrence !== undefined) {
    if (obj.recurrence === null) {
      recurrence = null;
    } else if (typeof obj.recurrence !== "object") {
      errors.push({ field: "recurrence", message: "recurrence must be an object" });
    } else {
      const rec = obj.recurrence as Record<string, unknown>;
      const frequency = typeof rec.frequency === "string" ? rec.frequency : "";
      if (!RECURRENCE_FREQUENCIES.includes(frequency as (typeof RECURRENCE_FREQUENCIES)[number])) {
        errors.push({ field: "recurrence.frequency", message: `frequency must be one of: ${RECURRENCE_FREQUENCIES.join(", ")}` });
      } else if (frequency === "none") {
        recurrence = null;
      } else {
        if (typeof rec.endDate !== "string" || rec.endDate.trim() === "") {
          errors.push({ field: "recurrence.endDate", message: "endDate is required for repeating events" });
        } else if (isNaN(Date.parse(rec.endDate as string))) {
          errors.push({ field: "recurrence.endDate", message: "endDate must be a valid ISO-8601 date string" });
        } else {
          const recurrenceEnd = rec.endDate.trim();
          if (startDate && new Date(recurrenceEnd) < startDate) {
            errors.push({ field: "recurrence.endDate", message: "endDate must be on or after the event start" });
          } else {
            recurrence = { frequency: frequency as RecurrenceRule["frequency"], endDate: recurrenceEnd };
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      title: (obj.title as string).trim(),
      description: (obj.description as string).trim(),
      dateTime: (obj.dateTime as string).trim(),
      endDateTime: (obj.endDateTime as string).trim(),
      locationId: (obj.locationId as string).trim(),
      recurrence,
    },
  };
}

export function validateLocationInput(body: unknown): {
  valid: true;
  data: CreateLocationInput;
} | {
  valid: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    errors.push({ field: "name", message: "name is required and must be a non-empty string" });
  } else if (obj.name.trim().length > 200) {
    errors.push({ field: "name", message: "name must be 200 characters or less" });
  }

  if (typeof obj.city !== "string" || obj.city.trim() === "") {
    errors.push({ field: "city", message: "city is required and must be a non-empty string" });
  }

  if (typeof obj.country !== "string" || obj.country.trim() === "") {
    errors.push({ field: "country", message: "country is required and must be a non-empty string" });
  }

  if (typeof obj.latitude !== "number" || obj.latitude < -90 || obj.latitude > 90) {
    errors.push({ field: "latitude", message: "latitude must be a number between -90 and 90" });
  }

  if (typeof obj.longitude !== "number" || obj.longitude < -180 || obj.longitude > 180) {
    errors.push({ field: "longitude", message: "longitude must be a number between -180 and 180" });
  }

  let what3names: string | null = null;
  if (obj.what3names !== undefined && obj.what3names !== null && obj.what3names !== "") {
    if (typeof obj.what3names !== "string") {
      errors.push({ field: "what3names", message: "What3Words must be a string" });
    } else {
      const normalized = obj.what3names.trim().replace(/\s+/g, ".");
      if (normalized.length > 100) {
        errors.push({ field: "what3names", message: "What3Words must be 100 characters or less" });
      } else {
        what3names = normalized;
      }
    }
  }

  let howToFind: string | null = null;
  if (obj.howToFind !== undefined && obj.howToFind !== null && obj.howToFind !== "") {
    if (typeof obj.howToFind !== "string") {
      errors.push({ field: "howToFind", message: "How to find us must be a string" });
    } else {
      const normalized = obj.howToFind.trim();
      if (normalized.length > 2000) {
        errors.push({ field: "howToFind", message: "How to find us must be 2000 characters or less" });
      } else {
        howToFind = normalized;
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      name: (obj.name as string).trim(),
      city: (obj.city as string).trim(),
      country: (obj.country as string).trim(),
      latitude: obj.latitude as number,
      longitude: obj.longitude as number,
      what3names,
      howToFind,
    },
  };
}

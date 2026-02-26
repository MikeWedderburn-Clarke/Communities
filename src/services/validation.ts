import { ROLES, type Role, type CreateEventInput, type CreateLocationInput } from "@/types";

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

  // Cross-field: end must be after start
  if (
    typeof obj.dateTime === "string" && !isNaN(Date.parse(obj.dateTime)) &&
    typeof obj.endDateTime === "string" && !isNaN(Date.parse(obj.endDateTime)) &&
    new Date(obj.endDateTime) <= new Date(obj.dateTime)
  ) {
    errors.push({ field: "endDateTime", message: "endDateTime must be after dateTime" });
  }

  if (typeof obj.locationId !== "string" || obj.locationId.trim() === "") {
    errors.push({ field: "locationId", message: "locationId is required and must be a non-empty string" });
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
    },
  };
}

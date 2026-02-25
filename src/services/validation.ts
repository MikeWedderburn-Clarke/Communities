import { ROLES, type Role } from "@/types";

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

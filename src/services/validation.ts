import { ROLES, RECURRENCE_FREQUENCIES, SKILL_LEVELS, BOOKING_PAYMENT_STATUSES, EVENT_GROUP_TYPES, type Role, type SkillLevel, type CreateEventInput, type CreateLocationInput, type RecurrenceRule, type CreateEventGroupInput, type CreateTicketTypeInput, type CreateBookingInput, type SetTeacherSplitInput, type UpdateBookingStatusInput, type BookingPaymentStatus, type EventGroupType } from "@/types";

export interface ValidationError {
  field: string;
  message: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateRsvpInput(body: unknown): {
  valid: true;
  data: { eventId: string; role: Role; showName: boolean; isTeaching: boolean; occurrenceDate: string | null };
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

  let occurrenceDate: string | null = null;
  if (obj.occurrenceDate !== undefined && obj.occurrenceDate !== null) {
    if (typeof obj.occurrenceDate !== "string" || !DATE_PATTERN.test(obj.occurrenceDate)) {
      errors.push({ field: "occurrenceDate", message: "occurrenceDate must be a YYYY-MM-DD date string" });
    } else {
      occurrenceDate = obj.occurrenceDate;
    }
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
      occurrenceDate,
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

  // ── New fields ──────────────────────────────────────────────────

  // skillLevel — optional, defaults to "All levels"
  let skillLevel: SkillLevel = "All levels";
  if (obj.skillLevel !== undefined && obj.skillLevel !== null) {
    if (!(SKILL_LEVELS as readonly string[]).includes(obj.skillLevel as string)) {
      errors.push({ field: "skillLevel", message: `skillLevel must be one of: ${SKILL_LEVELS.join(", ")}` });
    } else {
      skillLevel = obj.skillLevel as SkillLevel;
    }
  }

  // prerequisites — optional string, max 2000 chars
  let prerequisites: string | null = null;
  if (obj.prerequisites !== undefined && obj.prerequisites !== null && obj.prerequisites !== "") {
    if (typeof obj.prerequisites !== "string") {
      errors.push({ field: "prerequisites", message: "prerequisites must be a string" });
    } else {
      const trimmed = obj.prerequisites.trim();
      if (trimmed.length > 2000) {
        errors.push({ field: "prerequisites", message: "prerequisites must be 2000 characters or less" });
      } else {
        prerequisites = trimmed || null;
      }
    }
  }

  // costAmount — optional non-negative number
  let costAmount: number | null = null;
  if (obj.costAmount !== undefined && obj.costAmount !== null) {
    if (typeof obj.costAmount !== "number" || obj.costAmount < 0) {
      errors.push({ field: "costAmount", message: "costAmount must be a non-negative number" });
    } else {
      costAmount = obj.costAmount;
    }
  }

  // costCurrency — required when costAmount is set
  let costCurrency: string | null = null;
  if (costAmount !== null) {
    if (typeof obj.costCurrency !== "string" || obj.costCurrency.trim() === "") {
      errors.push({ field: "costCurrency", message: "costCurrency is required when costAmount is set" });
    } else {
      costCurrency = obj.costCurrency.trim().toUpperCase();
    }
  }

  // concessionAmount — optional, non-negative, only valid when costAmount present
  let concessionAmount: number | null = null;
  if (obj.concessionAmount !== undefined && obj.concessionAmount !== null) {
    if (costAmount === null) {
      errors.push({ field: "concessionAmount", message: "concessionAmount requires costAmount to be set" });
    } else if (typeof obj.concessionAmount !== "number" || obj.concessionAmount < 0) {
      errors.push({ field: "concessionAmount", message: "concessionAmount must be a non-negative number" });
    } else {
      concessionAmount = obj.concessionAmount;
    }
  }

  // maxAttendees — optional positive integer
  let maxAttendees: number | null = null;
  if (obj.maxAttendees !== undefined && obj.maxAttendees !== null) {
    if (typeof obj.maxAttendees !== "number" || !Number.isInteger(obj.maxAttendees) || obj.maxAttendees < 1) {
      errors.push({ field: "maxAttendees", message: "maxAttendees must be a positive integer" });
    } else {
      maxAttendees = obj.maxAttendees;
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
      skillLevel,
      prerequisites,
      costAmount,
      costCurrency,
      concessionAmount,
      maxAttendees,
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

// ── Event Group Validators ─────────────────────────────────────────

export function validateCreateEventGroupInput(body: unknown): {
  valid: true;
  data: CreateEventGroupInput;
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

  if (obj.description !== undefined && obj.description !== null && obj.description !== "") {
    if (typeof obj.description !== "string") {
      errors.push({ field: "description", message: "description must be a string" });
    } else if (obj.description.trim().length > 2000) {
      errors.push({ field: "description", message: "description must be 2000 characters or less" });
    }
  }

  if (typeof obj.type !== "string" || !(EVENT_GROUP_TYPES as readonly string[]).includes(obj.type)) {
    errors.push({ field: "type", message: `type must be one of: ${EVENT_GROUP_TYPES.join(", ")}` });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      name: (obj.name as string).trim(),
      description: typeof obj.description === "string" ? obj.description.trim() || null : null,
      type: obj.type as EventGroupType,
    },
  };
}

// ── Ticket Type Validators ─────────────────────────────────────────

export function validateCreateTicketTypeInput(body: unknown): {
  valid: true;
  data: CreateTicketTypeInput;
} | {
  valid: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.groupId !== "string" || obj.groupId.trim() === "") {
    errors.push({ field: "groupId", message: "groupId is required" });
  }

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    errors.push({ field: "name", message: "name is required and must be a non-empty string" });
  } else if (obj.name.trim().length > 200) {
    errors.push({ field: "name", message: "name must be 200 characters or less" });
  }

  let costAmount = 0;
  if (typeof obj.costAmount !== "number" || obj.costAmount < 0) {
    errors.push({ field: "costAmount", message: "costAmount must be a non-negative number" });
  } else {
    costAmount = obj.costAmount;
  }

  if (typeof obj.costCurrency !== "string" || obj.costCurrency.trim() === "") {
    errors.push({ field: "costCurrency", message: "costCurrency is required" });
  }

  if (obj.concessionAmount !== undefined && obj.concessionAmount !== null) {
    if (typeof obj.concessionAmount !== "number" || obj.concessionAmount < 0) {
      errors.push({ field: "concessionAmount", message: "concessionAmount must be a non-negative number" });
    }
  }

  if (obj.capacity !== undefined && obj.capacity !== null) {
    if (typeof obj.capacity !== "number" || !Number.isInteger(obj.capacity) || obj.capacity < 1) {
      errors.push({ field: "capacity", message: "capacity must be a positive integer" });
    }
  }

  if (!Array.isArray(obj.coveredEventIds) || obj.coveredEventIds.length === 0) {
    errors.push({ field: "coveredEventIds", message: "coveredEventIds must be a non-empty array of event IDs" });
  } else if (obj.coveredEventIds.some((id) => typeof id !== "string" || id.trim() === "")) {
    errors.push({ field: "coveredEventIds", message: "each coveredEventId must be a non-empty string" });
  }

  let sortOrder = 0;
  if (obj.sortOrder !== undefined && obj.sortOrder !== null) {
    if (typeof obj.sortOrder !== "number" || !Number.isInteger(obj.sortOrder)) {
      errors.push({ field: "sortOrder", message: "sortOrder must be an integer" });
    } else {
      sortOrder = obj.sortOrder;
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      groupId: (obj.groupId as string).trim(),
      name: (obj.name as string).trim(),
      description: typeof obj.description === "string" ? obj.description.trim() || null : null,
      costAmount,
      costCurrency: (obj.costCurrency as string).trim().toUpperCase(),
      concessionAmount: typeof obj.concessionAmount === "number" ? obj.concessionAmount : null,
      capacity: typeof obj.capacity === "number" ? obj.capacity : null,
      coveredEventIds: (obj.coveredEventIds as string[]).map((id) => id.trim()),
      sortOrder,
    },
  };
}

// ── Booking Validators ─────────────────────────────────────────────

export function validateCreateBookingInput(body: unknown): {
  valid: true;
  data: CreateBookingInput;
} | {
  valid: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.ticketTypeId !== "string" || obj.ticketTypeId.trim() === "") {
    errors.push({ field: "ticketTypeId", message: "ticketTypeId is required" });
  }

  // role is optional (null allowed)
  if (obj.role !== undefined && obj.role !== null) {
    if (typeof obj.role !== "string" || !(ROLES as readonly string[]).includes(obj.role)) {
      errors.push({ field: "role", message: `role must be one of: ${ROLES.join(", ")} or null` });
    }
  }

  if (typeof obj.showName !== "boolean") {
    errors.push({ field: "showName", message: "showName must be a boolean" });
  }

  if (obj.isTeaching !== undefined && typeof obj.isTeaching !== "boolean") {
    errors.push({ field: "isTeaching", message: "isTeaching must be a boolean" });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      ticketTypeId: (obj.ticketTypeId as string).trim(),
      role: (obj.role as Role | null) ?? null,
      showName: obj.showName as boolean,
      isTeaching: (obj.isTeaching as boolean) ?? false,
    },
  };
}

export function validateUpdateBookingStatusInput(body: unknown): {
  valid: true;
  data: UpdateBookingStatusInput;
} | {
  valid: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = body as Record<string, unknown>;

  if (
    typeof obj.paymentStatus !== "string" ||
    !(BOOKING_PAYMENT_STATUSES as readonly string[]).includes(obj.paymentStatus)
  ) {
    errors.push({
      field: "paymentStatus",
      message: `paymentStatus must be one of: ${BOOKING_PAYMENT_STATUSES.join(", ")}`,
    });
  }

  if (obj.amountPaid !== undefined && obj.amountPaid !== null) {
    if (typeof obj.amountPaid !== "number" || obj.amountPaid < 0) {
      errors.push({ field: "amountPaid", message: "amountPaid must be a non-negative number" });
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      paymentStatus: obj.paymentStatus as BookingPaymentStatus,
      amountPaid: typeof obj.amountPaid === "number" ? obj.amountPaid : null,
      notes: typeof obj.notes === "string" ? obj.notes.trim() || null : null,
    },
  };
}

// ── Teacher Split Validators ───────────────────────────────────────

export function validateSetTeacherSplitInput(body: unknown): {
  valid: true;
  data: SetTeacherSplitInput;
} | {
  valid: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.ticketTypeId !== "string" || obj.ticketTypeId.trim() === "") {
    errors.push({ field: "ticketTypeId", message: "ticketTypeId is required" });
  }

  if (typeof obj.teacherUserId !== "string" || obj.teacherUserId.trim() === "") {
    errors.push({ field: "teacherUserId", message: "teacherUserId is required" });
  }

  if (typeof obj.fixedAmount !== "number" || obj.fixedAmount < 0) {
    errors.push({ field: "fixedAmount", message: "fixedAmount must be a non-negative number" });
  }

  if (typeof obj.currency !== "string" || obj.currency.trim() === "") {
    errors.push({ field: "currency", message: "currency is required" });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      ticketTypeId: (obj.ticketTypeId as string).trim(),
      teacherUserId: (obj.teacherUserId as string).trim(),
      fixedAmount: obj.fixedAmount as number,
      currency: (obj.currency as string).trim().toUpperCase(),
    },
  };
}

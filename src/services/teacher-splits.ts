import { eq, and, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import type {
  SetTeacherSplitInput,
  TeacherReportLine,
  TeacherSplit,
} from "@/types";

function nowIso(): string {
  return new Date().toISOString();
}

function splitId(): string {
  return `ts-${crypto.randomUUID()}`;
}

// ── Writes ─────────────────────────────────────────────────────────

/**
 * Upsert a teacher split for a ticket type.
 * If the teacher already has a split for this ticket type, the fixed amount is updated.
 */
export async function setTeacherSplit(
  db: Db,
  input: SetTeacherSplitInput
): Promise<string> {
  // Validate teacher exists
  const teacher = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, input.teacherUserId))
    .limit(1);

  if (teacher.length === 0) {
    throw new Error(
      `Teacher with ID "${input.teacherUserId}" is not a registered user.`
    );
  }

  const id = splitId();

  await db
    .insert(schema.teacherSplits)
    .values({
      id,
      ticketTypeId: input.ticketTypeId,
      teacherUserId: input.teacherUserId,
      fixedAmount: input.fixedAmount,
      currency: input.currency,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    .onConflictDoUpdate({
      target: [schema.teacherSplits.ticketTypeId, schema.teacherSplits.teacherUserId],
      set: {
        fixedAmount: input.fixedAmount,
        currency: input.currency,
        updatedAt: nowIso(),
      },
    });

  return id;
}

export async function deleteTeacherSplit(
  db: Db,
  ticketTypeId: string,
  teacherUserId: string
): Promise<void> {
  await db
    .delete(schema.teacherSplits)
    .where(
      and(
        eq(schema.teacherSplits.ticketTypeId, ticketTypeId),
        eq(schema.teacherSplits.teacherUserId, teacherUserId)
      )
    );
}

// ── Reads ──────────────────────────────────────────────────────────

export async function getTeacherSplitsForGroup(
  db: Db,
  groupId: string
): Promise<TeacherSplit[]> {
  const rows = await db
    .select({
      id: schema.teacherSplits.id,
      ticketTypeId: schema.teacherSplits.ticketTypeId,
      ticketTypeName: schema.ticketTypes.name,
      teacherUserId: schema.teacherSplits.teacherUserId,
      teacherName: schema.users.name,
      fixedAmount: schema.teacherSplits.fixedAmount,
      currency: schema.teacherSplits.currency,
    })
    .from(schema.teacherSplits)
    .innerJoin(
      schema.ticketTypes,
      eq(schema.ticketTypes.id, schema.teacherSplits.ticketTypeId)
    )
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.teacherSplits.teacherUserId)
    )
    .where(eq(schema.ticketTypes.groupId, groupId))
    .orderBy(schema.users.name, schema.ticketTypes.sortOrder);

  return rows.map((r) => ({
    id: r.id,
    ticketTypeId: r.ticketTypeId,
    ticketTypeName: r.ticketTypeName,
    teacherUserId: r.teacherUserId,
    teacherName: r.teacherName,
    fixedAmount: r.fixedAmount,
    currency: r.currency,
  }));
}

/**
 * Returns a revenue breakdown per teacher per ticket type for a group.
 * Only counts bookings with paymentStatus "paid" or "concession_paid".
 */
export async function getTeacherReport(
  db: Db,
  groupId: string
): Promise<TeacherReportLine[]> {
  const rows = await db.execute(
    sql`
      SELECT
        ts.teacher_user_id    AS "teacherUserId",
        u.name                AS "teacherName",
        ts.ticket_type_id     AS "ticketTypeId",
        tt.name               AS "ticketTypeName",
        ts.fixed_amount       AS "fixedAmountPerBooking",
        ts.currency           AS "currency",
        COUNT(b.id)::int      AS "paidBookingCount",
        COUNT(b.id)::int * ts.fixed_amount AS "totalEarned"
      FROM teacher_splits ts
      INNER JOIN ticket_types tt ON tt.id = ts.ticket_type_id
      INNER JOIN users u ON u.id = ts.teacher_user_id
      LEFT JOIN bookings b
        ON b.ticket_type_id = ts.ticket_type_id
        AND b.payment_status IN ('paid', 'concession_paid')
      WHERE tt.group_id = ${groupId}
      GROUP BY
        ts.teacher_user_id, u.name,
        ts.ticket_type_id, tt.name,
        ts.fixed_amount, ts.currency, tt.sort_order
      ORDER BY u.name, tt.sort_order
    `
  );

  const resultRows = (rows as any).rows ?? rows;
  return resultRows.map((r: any) => ({
    teacherUserId: r.teacherUserId,
    teacherName: r.teacherName,
    ticketTypeId: r.ticketTypeId,
    ticketTypeName: r.ticketTypeName,
    paidBookingCount: Number(r.paidBookingCount),
    fixedAmountPerBooking: Number(r.fixedAmountPerBooking),
    currency: r.currency,
    totalEarned: Number(r.totalEarned),
  }));
}

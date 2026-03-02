import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb, resetDb } from "@/db/test-utils";
import * as schema from "@/db/schema";
import { createEventGroup } from "@/services/event-groups";
import { createTicketType } from "@/services/ticket-types";
import { createBooking, updateBookingPaymentStatus } from "@/services/bookings";
import { setTeacherSplit, getTeacherSplitsForGroup, getTeacherReport } from "@/services/teacher-splits";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function seed(db: TestDb) {
  await db.insert(schema.users).values([
    { id: "u-teacher", name: "Teacher Joe", email: "joe@test.com", isAdmin: false, isTeacherApproved: true },
    { id: "u-student", name: "Alice", email: "alice@test.com", isAdmin: false },
    { id: "u-student2", name: "Bob", email: "bob@test.com", isAdmin: false },
  ]);
  await db.insert(schema.locations).values({
    id: "loc1", name: "Studio", city: "London", country: "UK", latitude: 51.5, longitude: -0.1,
  });
  await db.insert(schema.events).values([
    { id: "e-workshop", title: "Workshop", description: "Technique", dateTime: "2026-09-01T10:00:00Z", endDateTime: "2026-09-01T12:00:00Z", locationId: "loc1", status: "approved", dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-01T00:00:00Z" },
    { id: "e-jam", title: "Jam", description: "Social", dateTime: "2026-09-01T13:00:00Z", endDateTime: "2026-09-01T17:00:00Z", locationId: "loc1", status: "approved", dateAdded: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-01T00:00:00Z" },
  ]);
}

describe("teacher-splits service", () => {
  let db: TestDb;
  let ttWorkshopOnly: string;
  let ttCombo: string;
  let groupId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await (db as any).$pglite?.close();
  });

  beforeEach(async () => {
    await resetDb(db);
    await seed(db);

    groupId = await createEventGroup(db, { name: "Workshop + Jam", description: null, type: "combo" }, "u-teacher");
    ttWorkshopOnly = await createTicketType(db, {
      groupId, name: "Workshop Only", description: null,
      costAmount: 15, costCurrency: "GBP", concessionAmount: null,
      capacity: 20, coveredEventIds: ["e-workshop"], sortOrder: 0,
    });
    ttCombo = await createTicketType(db, {
      groupId, name: "Workshop + Jam", description: null,
      costAmount: 20, costCurrency: "GBP", concessionAmount: null,
      capacity: 20, coveredEventIds: ["e-workshop", "e-jam"], sortOrder: 1,
    });
  });

  it("setTeacherSplit creates a new split", async () => {
    await setTeacherSplit(db, { ticketTypeId: ttWorkshopOnly, teacherUserId: "u-teacher", fixedAmount: 12, currency: "GBP" });
    const splits = await getTeacherSplitsForGroup(db, groupId);
    expect(splits).toHaveLength(1);
    expect(splits[0].fixedAmount).toBe(12);
    expect(splits[0].teacherName).toBe("Teacher Joe");
    expect(splits[0].ticketTypeName).toBe("Workshop Only");
  });

  it("setTeacherSplit upserts — updates fixedAmount on conflict", async () => {
    await setTeacherSplit(db, { ticketTypeId: ttWorkshopOnly, teacherUserId: "u-teacher", fixedAmount: 12, currency: "GBP" });
    await setTeacherSplit(db, { ticketTypeId: ttWorkshopOnly, teacherUserId: "u-teacher", fixedAmount: 14, currency: "GBP" });
    const splits = await getTeacherSplitsForGroup(db, groupId);
    expect(splits).toHaveLength(1);
    expect(splits[0].fixedAmount).toBe(14);
  });

  it("setTeacherSplit supports different amounts for different ticket types", async () => {
    await setTeacherSplit(db, { ticketTypeId: ttWorkshopOnly, teacherUserId: "u-teacher", fixedAmount: 12, currency: "GBP" });
    await setTeacherSplit(db, { ticketTypeId: ttCombo, teacherUserId: "u-teacher", fixedAmount: 12, currency: "GBP" });
    const splits = await getTeacherSplitsForGroup(db, groupId);
    expect(splits).toHaveLength(2);
  });

  it("setTeacherSplit throws when teacher user does not exist", async () => {
    await expect(
      setTeacherSplit(db, { ticketTypeId: ttWorkshopOnly, teacherUserId: "u-nonexistent", fixedAmount: 12, currency: "GBP" })
    ).rejects.toThrow("not a registered user");
  });

  it("getTeacherReport only counts paid/concession_paid bookings", async () => {
    await setTeacherSplit(db, { ticketTypeId: ttWorkshopOnly, teacherUserId: "u-teacher", fixedAmount: 12, currency: "GBP" });
    await setTeacherSplit(db, { ticketTypeId: ttCombo, teacherUserId: "u-teacher", fixedAmount: 12, currency: "GBP" });

    // Create bookings
    const b1 = await createBooking(db, "u-student", { ticketTypeId: ttWorkshopOnly, role: "Base", showName: false, isTeaching: false });
    const b2 = await createBooking(db, "u-student2", { ticketTypeId: ttCombo, role: "Flyer", showName: false, isTeaching: false });

    // Mark b1 as paid, leave b2 as pending
    await updateBookingPaymentStatus(db, b1, { paymentStatus: "paid", amountPaid: 15, notes: null });

    const report = await getTeacherReport(db, groupId);
    // Only workshop-only (paid) should have count > 0
    const workshopLine = report.find((r) => r.ticketTypeId === ttWorkshopOnly);
    const comboLine = report.find((r) => r.ticketTypeId === ttCombo);

    expect(workshopLine?.paidBookingCount).toBe(1);
    expect(workshopLine?.totalEarned).toBe(12);
    expect(comboLine?.paidBookingCount).toBe(0);
    expect(comboLine?.totalEarned).toBe(0);
  });

  it("getTeacherReport includes concession_paid bookings", async () => {
    await setTeacherSplit(db, { ticketTypeId: ttWorkshopOnly, teacherUserId: "u-teacher", fixedAmount: 12, currency: "GBP" });

    const b1 = await createBooking(db, "u-student", { ticketTypeId: ttWorkshopOnly, role: "Base", showName: false, isTeaching: false });
    await updateBookingPaymentStatus(db, b1, { paymentStatus: "concession_paid", amountPaid: 10, notes: null });

    const report = await getTeacherReport(db, groupId);
    const line = report.find((r) => r.ticketTypeId === ttWorkshopOnly);
    expect(line?.paidBookingCount).toBe(1);
    expect(line?.totalEarned).toBe(12);
  });

  it("getTeacherReport excludes refunded bookings", async () => {
    await setTeacherSplit(db, { ticketTypeId: ttWorkshopOnly, teacherUserId: "u-teacher", fixedAmount: 12, currency: "GBP" });

    const b1 = await createBooking(db, "u-student", { ticketTypeId: ttWorkshopOnly, role: "Base", showName: false, isTeaching: false });
    await updateBookingPaymentStatus(db, b1, { paymentStatus: "paid", amountPaid: 15, notes: null });
    await updateBookingPaymentStatus(db, b1, { paymentStatus: "refunded", amountPaid: null, notes: "refunded" });

    const report = await getTeacherReport(db, groupId);
    const line = report.find((r) => r.ticketTypeId === ttWorkshopOnly);
    expect(line?.paidBookingCount).toBe(0);
    expect(line?.totalEarned).toBe(0);
  });

  it("getTeacherReport returns empty when no splits configured", async () => {
    const report = await getTeacherReport(db, groupId);
    expect(report).toHaveLength(0);
  });
});

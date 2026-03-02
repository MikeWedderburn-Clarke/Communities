import { notFound, redirect } from "next/navigation";
import { getEventGroupById } from "@/services/event-groups";
import { getTeacherReport } from "@/services/teacher-splits";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function TeacherReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/");

  const group = await getEventGroupById(db, id, true);
  if (!group) notFound();

  const report = await getTeacherReport(db, id);

  // Group report lines by teacher for summary totals
  const byTeacher = new Map<string, { name: string; totalByCurrency: Map<string, number> }>();
  for (const line of report) {
    if (!byTeacher.has(line.teacherUserId)) {
      byTeacher.set(line.teacherUserId, { name: line.teacherName, totalByCurrency: new Map() });
    }
    const entry = byTeacher.get(line.teacherUserId)!;
    const current = entry.totalByCurrency.get(line.currency) ?? 0;
    entry.totalByCurrency.set(line.currency, current + line.totalEarned);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/admin/groups" className="text-indigo-600 hover:underline">Groups</Link>
        <span className="text-gray-400">›</span>
        <Link href={`/admin/groups/${id}`} className="text-indigo-600 hover:underline">{group.name}</Link>
        <span className="text-gray-400">›</span>
        <span className="text-gray-700">Teacher Report</span>
      </nav>

      <h1 className="mt-4 text-2xl font-bold">Teacher Revenue Report — {group.name}</h1>

      {report.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No teacher splits configured for this group.</p>
      ) : (
        <>
          {/* Summary totals */}
          <section className="mt-6">
            <h2 className="text-base font-semibold">Summary</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-1">Teacher</th>
                  <th className="pb-1">Total earned</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(byTeacher.entries()).map(([userId, entry]) => (
                  <tr key={userId} className="border-b last:border-0">
                    <td className="py-2 font-medium">{entry.name}</td>
                    <td className="py-2">
                      {Array.from(entry.totalByCurrency.entries()).map(([cur, amount]) => (
                        <span key={cur} className="mr-2">{formatPrice(amount, cur)}</span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Breakdown per ticket type */}
          <section className="mt-8">
            <h2 className="text-base font-semibold">Breakdown by ticket type</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-1">Teacher</th>
                  <th className="pb-1">Ticket type</th>
                  <th className="pb-1">Per booking</th>
                  <th className="pb-1">Paid bookings</th>
                  <th className="pb-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.map((line, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{line.teacherName}</td>
                    <td className="py-2">{line.ticketTypeName}</td>
                    <td className="py-2">{formatPrice(line.fixedAmountPerBooking, line.currency)}</td>
                    <td className="py-2">{line.paidBookingCount}</td>
                    <td className="py-2 font-semibold">{formatPrice(line.totalEarned, line.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

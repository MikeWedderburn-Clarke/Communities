import { notFound, redirect } from "next/navigation";
import { getEventGroupById } from "@/services/event-groups";
import { getBookingsForGroup } from "@/services/bookings";
import { getTeacherSplitsForGroup } from "@/services/teacher-splits";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatPrice(amount: number | null, currency: string | null): string {
  if (amount === null || currency === null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  concession_paid: "Paid (concession)",
  comp: "Comp",
  refunded: "Refunded",
};

export default async function AdminGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const db = await getDb();
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/");

  const group = await getEventGroupById(db, id, true);
  if (!group) notFound();

  const [bookings, teacherSplits] = await Promise.all([
    getBookingsForGroup(db, id),
    getTeacherSplitsForGroup(db, id),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/admin/groups" className="text-indigo-600 hover:underline">Groups</Link>
        <span className="text-gray-400">›</span>
        <span className="text-gray-700">{group.name}</span>
      </nav>

      <div className="mt-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${group.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {group.status}
        </span>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-indigo-600 hover:underline"
        >
          Public page
        </Link>
        <Link
          href={`/admin/groups/${id}/teacher-report`}
          className="text-sm text-indigo-600 hover:underline"
        >
          Teacher report
        </Link>
      </div>

      {/* Member events */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Member Events ({group.memberEvents.length})</h2>
        {group.memberEvents.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No events linked yet.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {group.memberEvents.map((e) => (
              <li key={e.eventId} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 text-sm">
                <Link href={`/events/${e.eventId}`} className="hover:text-indigo-600 hover:underline">
                  {e.title}
                </Link>
                <span className="text-xs text-gray-400">
                  {new Date(e.dateTime).toLocaleDateString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ticket types */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Ticket Types ({group.ticketTypes.length})</h2>
        {group.ticketTypes.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No ticket types defined yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-1">Name</th>
                <th className="pb-1">Price</th>
                <th className="pb-1">Capacity</th>
                <th className="pb-1">Booked</th>
                <th className="pb-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {group.ticketTypes.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{t.name}</td>
                  <td className="py-2">{formatPrice(t.costAmount, t.costCurrency)}</td>
                  <td className="py-2">{t.capacity ?? "∞"}</td>
                  <td className="py-2">{t.bookedCount}</td>
                  <td className="py-2">
                    <span className={`text-xs font-medium ${t.isAvailable ? (t.isSoldOut ? "text-red-600" : "text-green-600") : "text-gray-400"}`}>
                      {!t.isAvailable ? "Unavailable" : t.isSoldOut ? "Sold out" : "Available"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Teacher splits */}
      {teacherSplits.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Teacher Splits</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-1">Teacher</th>
                <th className="pb-1">Ticket type</th>
                <th className="pb-1">Per booking</th>
              </tr>
            </thead>
            <tbody>
              {teacherSplits.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2">{s.teacherName}</td>
                  <td className="py-2">{s.ticketTypeName}</td>
                  <td className="py-2">{formatPrice(s.fixedAmount, s.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Bookings */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Bookings ({bookings.length})</h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No bookings yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-1">User</th>
                <th className="pb-1">Ticket</th>
                <th className="pb-1">Status</th>
                <th className="pb-1">Amount paid</th>
                <th className="pb-1">Booked at</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b last:border-0 text-sm">
                  <td className="py-2 text-xs text-gray-500">{b.userId}</td>
                  <td className="py-2">{b.ticketTypeName}</td>
                  <td className="py-2">
                    <span className={`text-xs font-medium ${b.paymentStatus === "paid" || b.paymentStatus === "concession_paid" || b.paymentStatus === "comp" ? "text-green-600" : b.paymentStatus === "refunded" ? "text-gray-400" : "text-amber-600"}`}>
                      {PAYMENT_STATUS_LABELS[b.paymentStatus] ?? b.paymentStatus}
                    </span>
                  </td>
                  <td className="py-2">{formatPrice(b.amountPaid, b.currency)}</td>
                  <td className="py-2 text-xs text-gray-400">
                    {new Date(b.bookedAt).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

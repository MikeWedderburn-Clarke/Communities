import { notFound } from "next/navigation";
import { getEventGroupById } from "@/services/event-groups";
import { getBookingsForUser } from "@/services/bookings";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatPrice(amount: number, currency: string): string {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const db = await getDb();
  const { id } = await params;
  const user = await getCurrentUser();

  const group = await getEventGroupById(db, id, user?.isAdmin ?? false);
  if (!group) notFound();

  const userBookings = user
    ? await getBookingsForUser(db, user.id, id)
    : [];

  const userBookingsByTicketType = new Map(userBookings.map((b) => [b.ticketTypeId, b]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/events" className="text-indigo-600 hover:underline">Events</Link>
        <span className="text-gray-400">›</span>
        <span className="text-gray-700">{group.name}</span>
      </nav>

      <h1 className="mt-4 text-3xl font-bold">{group.name}</h1>

      {group.description && (
        <p className="mt-3 leading-relaxed text-gray-700">{group.description}</p>
      )}

      {/* Member events */}
      {group.memberEvents.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">
            {group.type === "festival" ? "Festival Days" : group.type === "combo" ? "Sessions" : "Events"}
          </h2>
          <ul className="mt-3 space-y-2">
            {group.memberEvents.map((e) => (
              <li key={e.eventId}>
                <Link
                  href={`/events/${e.eventId}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                >
                  <span className="font-medium text-sm">{e.title}</span>
                  <span className="text-xs text-gray-500">{formatDate(e.dateTime)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ticket types */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Tickets</h2>

        {group.ticketTypes.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No tickets are currently available.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {group.ticketTypes.map((t) => {
              const booking = userBookingsByTicketType.get(t.id);
              const remaining = t.capacity !== null ? t.capacity - t.bookedCount : null;

              return (
                <div
                  key={t.id}
                  className={`rounded-lg border p-4 ${t.isSoldOut ? "border-gray-100 bg-gray-50 opacity-75" : "border-gray-200"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-sm">{t.name}</h3>
                      {t.description && (
                        <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>
                      )}
                      {t.concessionAmount !== null && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          Concession: {formatPrice(t.concessionAmount, t.costCurrency)}
                        </p>
                      )}
                      {remaining !== null && remaining <= 5 && !t.isSoldOut && (
                        <p className="mt-1 text-xs font-medium text-amber-600">{remaining} left</p>
                      )}
                      {t.isSoldOut && (
                        <p className="mt-1 text-xs font-medium text-red-600">Sold out</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm text-indigo-700">
                        {formatPrice(t.costAmount, t.costCurrency)}
                      </p>
                    </div>
                  </div>

                  {booking && booking.paymentStatus !== "refunded" && (
                    <div className="mt-2 rounded bg-green-50 px-2 py-1 text-xs text-green-700 font-medium inline-block">
                      Booked
                      {booking.paymentStatus === "pending" && " — awaiting payment"}
                    </div>
                  )}

                  {!booking && !t.isSoldOut && user && (
                    <Link
                      href={`/events/${t.coveredEventIds[0]}`}
                      className="mt-3 inline-block rounded bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700"
                    >
                      Book
                    </Link>
                  )}

                  {!user && !t.isSoldOut && (
                    <Link
                      href="/login"
                      className="mt-3 inline-block text-sm text-indigo-600 hover:underline"
                    >
                      Log in to book
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

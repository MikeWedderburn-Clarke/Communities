import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getPendingTeacherRequests, getPendingEvents } from "@/services/events";
import { db } from "@/db";

export async function Header() {
  const user = await getCurrentUser();
  let pendingCount = 0;
  if (user?.isAdmin) {
    const [pendingTeachers, pendingEvts] = await Promise.all([
      getPendingTeacherRequests(db),
      getPendingEvents(db),
    ]);
    pendingCount = pendingTeachers.length + pendingEvts.length;
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/events" className="text-lg font-bold text-indigo-600">
          AcroYoga London
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/events" className="text-sm hover:text-indigo-600">
            Events
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/events/create" className="text-sm hover:text-indigo-600">
                + Create
              </Link>
              {user.isAdmin && (
                <Link href="/admin/alerts" className="relative text-sm hover:text-indigo-600">
                  Admin
                  {pendingCount > 0 && (
                    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              )}
              <Link href="/profile" className="text-sm text-gray-600 hover:text-indigo-600">{user.name}</Link>
              <form action="/logout" method="POST">
                <button
                  type="submit"
                  className="text-sm text-gray-500 hover:text-gray-800"
                >
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
            >
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getPendingTeacherRequests, getPendingEvents } from "@/services/events";
import { getDb } from "@/db";
import { DbModeToggle } from "./db-mode-toggle";

export async function Header() {
  const db = await getDb();
  const user = await getCurrentUser();
  let pendingCount = 0;
  if (user?.isAdmin) {
    const [pendingTeachers, pendingEvts] = await Promise.all([
      getPendingTeacherRequests(db),
      getPendingEvents(db),
    ]);
    pendingCount = pendingTeachers.length + pendingEvts.length;
  }

  const cookieStore = await cookies();
  const isTestMode = cookieStore.get("db_mode")?.value === "test";

  return (
    <>
      {isTestMode && (
        <div className="bg-amber-400 py-1 text-center text-xs font-bold text-amber-900">
          ⚠️ TEST DATABASE — data shown is for testing only
        </div>
      )}
      <header className="border-b border-gray-200 bg-white">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/events" className="text-lg font-bold text-indigo-600">
            AcroYoga London
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/events" className="text-sm hover:text-indigo-600">
              Events
            </Link>
            <Link href="/users" className="text-sm hover:text-indigo-600">
              Users
            </Link>
            <Link href="/locations" className="text-sm hover:text-indigo-600">
              Locations
            </Link>
            {user ? (
              <div className="flex items-center gap-3">
                {user.isAdmin && (
                  <>
                    <DbModeToggle isTestMode={isTestMode} />
                    <Link href="/admin/alerts" className="relative text-sm hover:text-indigo-600">
                      Admin
                      {pendingCount > 0 && (
                        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  </>
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
    </>
  );
}

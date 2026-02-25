import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const user = await getCurrentUser();

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
              <span className="text-sm text-gray-600">{user.name}</span>
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

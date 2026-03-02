import { listEventGroups } from "@/services/event-groups";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/");

  const groups = await listEventGroups(db, true);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Event Groups</h1>
        <Link
          href="/admin/groups/new"
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          Create group
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No event groups yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/admin/groups/${g.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
              >
                <div>
                  <span className="font-medium">{g.name}</span>
                  <span className="ml-2 text-xs text-gray-400 capitalize">{g.type}</span>
                </div>
                <span className={`text-xs font-medium ${g.status === "published" ? "text-green-600" : "text-amber-600"}`}>
                  {g.status === "published" ? "Published" : "Draft"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

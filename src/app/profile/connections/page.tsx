import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { getOutgoingRelationships, getFollowers } from "@/services/users";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [outgoing, followers] = await Promise.all([
    getOutgoingRelationships(db, user.id),
    getFollowers(db, user.id),
  ]);

  const following = outgoing.filter((r) => r.type === "following");
  const friends = outgoing.filter((r) => r.type === "friend");

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/profile"
          className="text-sm text-indigo-600 hover:underline"
        >
          &larr; Back to profile
        </Link>

        <h1 className="mt-4 text-3xl font-bold">Connections</h1>

        {/* Following */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Following ({following.length})
          </h2>
          {following.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {following.map((r) => (
                <li key={r.targetUserId}>
                  <Link
                    href={`/profile/${r.targetUserId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {r.targetName}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Not following anyone yet.</p>
          )}
        </section>

        {/* Friends */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Friends ({friends.length})
          </h2>
          {friends.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {friends.map((r) => (
                <li key={r.targetUserId}>
                  <Link
                    href={`/profile/${r.targetUserId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {r.targetName}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No friends added yet.</p>
          )}
        </section>

        {/* Followers */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Followers ({followers.length})
          </h2>
          {followers.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {followers.map((f) => (
                <li key={f.userId}>
                  <Link
                    href={`/profile/${f.userId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {f.userName}
                  </Link>
                  <span className="ml-2 text-xs text-gray-400 capitalize">{f.type}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No followers yet.</p>
          )}
        </section>
      </main>
    </>
  );
}

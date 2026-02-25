import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProfile } from "@/services/users";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const profile = await getPublicProfile(db, id);

  if (!profile) {
    notFound();
  }

  const links = [
    { label: "Facebook", url: profile.facebookUrl },
    { label: "Instagram", url: profile.instagramUrl },
    { label: "Website", url: profile.websiteUrl },
    { label: "YouTube", url: profile.youtubeUrl },
  ].filter((l) => l.url !== null);

  const isOwnProfile = user.id === profile.id;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/events"
          className="text-sm text-indigo-600 hover:underline"
        >
          &larr; Back to events
        </Link>

        <h1 className="mt-4 text-3xl font-bold">{profile.name}</h1>

        <section className="mt-6">
          {links.length > 0 ? (
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {link.label} &rarr;
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              No public info available
            </p>
          )}
        </section>

        {isOwnProfile && (
          <div className="mt-6">
            <Link
              href="/profile"
              className="text-sm text-indigo-600 hover:underline"
            >
              Edit profile
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

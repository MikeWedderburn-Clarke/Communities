import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold">AcroYoga London</h1>
      <p className="mt-4 text-lg text-gray-600">
        Find jams, workshops, and community events near you.
      </p>
      <Link
        href="/events"
        className="mt-8 inline-block rounded-lg bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700"
      >
        Browse Events
      </Link>
    </main>
  );
}

import { Suspense } from "react";
import { UsersContent } from "./users-content";
import { getAllUsers } from "@/services/users";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.isAdmin ?? false;
  const users = await getAllUsers(db, isAdmin);

  return (
    <main className="mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold">Users</h1>
      <p className="mt-1 text-gray-600">
        {isAdmin
          ? "All registered users (admin view)"
          : "Community members with public profiles"}
      </p>
      <Suspense fallback={<p className="mt-8 text-gray-400">Loading…</p>}>
        <UsersContent users={users} isAdmin={isAdmin} />
      </Suspense>
    </main>
  );
}

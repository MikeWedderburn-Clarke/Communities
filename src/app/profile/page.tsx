import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfile } from "@/services/users";
import { db } from "@/db";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/profile");
  }

  const profile = await getUserProfile(db, user.id);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold">Your Profile</h1>
        <p className="mt-1 text-sm text-gray-500">{user.email}</p>

        <ProfileForm profile={profile!} />
      </main>
    </>
  );
}

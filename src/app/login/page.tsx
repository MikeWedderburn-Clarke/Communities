import { redirect } from "next/navigation";
import { getMockUsers, setSessionCookie } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect ?? "/events";
  const mockUsers = await getMockUsers();

  async function loginAction(formData: FormData) {
    "use server";
    const userId = formData.get("userId") as string;
    if (!userId) return;
    await setSessionCookie(userId);
    redirect(redirectTo);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Log In</h1>
      <p className="mt-2 text-sm text-gray-500">
        Mock auth — pick a test user. TODO: replace with real auth.
      </p>
      <form action={loginAction} className="mt-6 space-y-3">
        <input type="hidden" name="redirect" value={redirectTo} />
        {mockUsers.map((user) => (
          <button
            key={user.id}
            type="submit"
            name="userId"
            value={user.id}
            className="block w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-indigo-400 hover:bg-indigo-50"
          >
            <span className="font-medium">{user.name}</span>
            <span className="ml-2 text-sm text-gray-500">{user.email}</span>
          </button>
        ))}
      </form>
    </main>
  );
}

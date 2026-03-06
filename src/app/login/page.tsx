import { signIn } from "@/auth";
import { getMockUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  // Prevent open-redirect: only allow relative paths
  const raw = params.redirect ?? "/events";
  const redirectTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/events";

  const isMock = process.env.MOCK_AUTH === "true";
  const hasEntra = Boolean(process.env.AUTH_ENTRA_CLIENT_ID);

  const mockUsers = isMock ? await getMockUsers() : [];

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Log In</h1>

      {isMock && (
        <>
          <p className="mt-2 text-sm text-gray-500">
            Development mode — pick a mock user.
          </p>
          <div className="mt-6 space-y-3">
            {mockUsers.map((user) => (
              <form
                key={user.id}
                action={async () => {
                  "use server";
                  await signIn("mock", { userId: user.id, redirectTo });
                }}
              >
                <button
                  type="submit"
                  className="block w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-indigo-400 hover:bg-indigo-50"
                >
                  <span className="font-medium">{user.name}</span>
                  {user.isAdmin && (
                    <span className="ml-1.5 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                      admin
                    </span>
                  )}
                  <span className="ml-2 text-sm text-gray-500">{user.email}</span>
                </button>
              </form>
            ))}
          </div>
        </>
      )}

      {hasEntra && (
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-3 hover:border-indigo-400 hover:bg-indigo-50"
          >
            Sign in with Microsoft
          </button>
        </form>
      )}

      {!isMock && !hasEntra && (
        <p className="mt-4 text-sm text-red-600">
          No authentication provider is configured.
        </p>
      )}
    </main>
  );
}

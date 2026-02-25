import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { getPendingTeacherRequests, approveTeacher, denyTeacher } from "@/services/events";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    redirect("/events");
  }

  const pendingRequests = await getPendingTeacherRequests(db);

  async function handleApprove(formData: FormData) {
    "use server";
    const userId = formData.get("userId") as string;
    if (!userId) return;
    await approveTeacher(db, userId, user!.id);
    revalidatePath("/admin/alerts");
  }

  async function handleDeny(formData: FormData) {
    "use server";
    const userId = formData.get("userId") as string;
    if (!userId) return;
    await denyTeacher(db, userId);
    revalidatePath("/admin/alerts");
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Admin Alerts</h1>
        <p className="mt-1 text-gray-600">
          Pending actions requiring your attention
        </p>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Teacher Requests</h2>
          {pendingRequests.length === 0 ? (
            <p className="mt-3 text-gray-500">No pending teacher requests.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pendingRequests.map((req) => (
                <li
                  key={req.userId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div>
                    <p className="font-medium">{req.userName}</p>
                    <p className="text-sm text-gray-500">{req.userEmail}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Requested{" "}
                      {new Date(req.requestedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={handleApprove}>
                      <input type="hidden" name="userId" value={req.userId} />
                      <button
                        type="submit"
                        className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={handleDeny}>
                      <input type="hidden" name="userId" value={req.userId} />
                      <button
                        type="submit"
                        className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        Deny
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

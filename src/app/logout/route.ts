import { signOut } from "@/auth";

export async function POST() {
  await signOut({ redirectTo: "/events" });
}

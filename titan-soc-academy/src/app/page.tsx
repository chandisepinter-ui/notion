import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/guards";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? homePathFor(user) : "/login");
}

"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { createSession, destroySession } from "./session";
import { isDemoAuth } from "./config";
import { PREF_COOKIES } from "@/lib/prefs/prefs";

/** DEMO ONLY: signs in as a fictional demonstration account. Refused unless AUTH_MODE=demo. */
export async function demoSignIn(formData: FormData) {
  if (!isDemoAuth()) throw new Error("Demonstration sign-in is disabled on this server.");
  const userId = String(formData.get("userId") ?? "");
  const user = await db.query.users.findFirst({
    where: and(eq(schema.users.id, userId), eq(schema.users.isDemo, true), eq(schema.users.active, true)),
  });
  if (!user) redirect("/login?error=unknown");
  await createSession(user.id);
  // Apply the profile's saved display preferences to this browser.
  const jar = await cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  jar.set(PREF_COOKIES.theme, user.themePref, opts);
  jar.set(PREF_COOKIES.text, user.textSizePref, opts);
  jar.set(PREF_COOKIES.motion, user.motionPref, opts);
  // The root page routes each person to the right dashboard for their permissions.
  redirect("/");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

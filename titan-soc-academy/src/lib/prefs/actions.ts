"use server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { MOTIONS, PREF_COOKIES, TEXT_SIZES, THEMES, pick } from "./prefs";

const YEAR = 60 * 60 * 24 * 365;

/** Saves display preferences to a cookie (this browser) and to the profile (every device). */
export async function savePreferences(input: { theme?: string; textSize?: string; motion?: string }) {
  const jar = await cookies();
  const user = await getSessionUser();
  const update: Partial<typeof schema.users.$inferInsert> = {};
  if (input.theme !== undefined) {
    const v = pick(THEMES, input.theme, "system");
    jar.set(PREF_COOKIES.theme, v, { path: "/", maxAge: YEAR, sameSite: "lax" });
    update.themePref = v;
  }
  if (input.textSize !== undefined) {
    const v = pick(TEXT_SIZES, input.textSize, "standard");
    jar.set(PREF_COOKIES.text, v, { path: "/", maxAge: YEAR, sameSite: "lax" });
    update.textSizePref = v;
  }
  if (input.motion !== undefined) {
    const v = pick(MOTIONS, input.motion, "system");
    jar.set(PREF_COOKIES.motion, v, { path: "/", maxAge: YEAR, sameSite: "lax" });
    update.motionPref = v;
  }
  if (user && Object.keys(update).length) {
    await db.update(schema.users).set(update).where(eq(schema.users.id, user.id));
  }
  return { ok: true };
}

import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { PermissionKey } from "./permissions";

const SESSION_COOKIE = "titan_session";
const SESSION_HOURS = 12;

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Run `npm run setup` (or set a 32+ character value in .env).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(getSecret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

async function readUserIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export type SessionUser = {
  id: string;
  displayName: string;
  email: string;
  title: string | null;
  shift: string | null;
  isDemo: boolean;
  graduatedAt: Date | null;
  roles: { key: string; name: string; rank: number }[];
  primaryRole: { key: string; name: string; rank: number };
  permissions: Set<PermissionKey>;
  prefs: { theme: string; textSize: string; motion: string };
};

/**
 * Loads the signed-in user with roles and permissions FRESH from the database
 * on every request, so role changes take effect immediately.
 * Cached per request via React `cache`.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const userId = await readUserIdFromCookie();
  if (!userId) return null;

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user || !user.active) return null;

  const roleRows = await db
    .select({ id: schema.roles.id, key: schema.roles.key, name: schema.roles.name, rank: schema.roles.rank })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
    .where(eq(schema.userRoles.userId, user.id));

  const permRows = roleRows.length
    ? await db
        .select({ key: schema.rolePermissions.permissionKey })
        .from(schema.rolePermissions)
        .where(inArray(schema.rolePermissions.roleId, roleRows.map((r) => r.id)))
    : [];

  const roles = roleRows.map(({ key, name, rank }) => ({ key, name, rank })).sort((a, b) => b.rank - a.rank);
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    title: user.title,
    shift: user.shift,
    isDemo: user.isDemo,
    graduatedAt: user.graduatedAt ?? null,
    roles,
    primaryRole: roles[0] ?? { key: "NONE", name: "No role assigned", rank: 0 },
    permissions: new Set(permRows.map((p) => p.key as PermissionKey)),
    prefs: { theme: user.themePref, textSize: user.textSizePref, motion: user.motionPref },
  };
});

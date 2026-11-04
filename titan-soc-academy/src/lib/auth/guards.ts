import "server-only";
import { redirect, forbidden } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";
import type { PermissionKey } from "./permissions";

export function can(user: SessionUser | null, permission: PermissionKey): boolean {
  return !!user && user.permissions.has(permission);
}

/** Use in pages/layouts: sends signed-out visitors to the sign-in page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Use in pages: signed-out -> sign in; signed-in without permission -> 403 page. */
export async function requirePermission(permission: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) forbidden();
  return user;
}

/** Use in server actions: never redirect, throw instead (actions return errors to the UI). */
export async function assertPermission(permission: PermissionKey): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Your session has ended. Please sign in again.");
  if (!can(user, permission)) throw new Error("You do not have permission to do that.");
  return user;
}

/** Where each person lands after sign-in, based on permissions (not names). */
export function homePathFor(user: SessionUser): string {
  if (user.permissions.has("admin.users.manage")) return "/admin";
  if (user.permissions.has("supervisor.trainees.view")) return "/supervisor";
  return "/dashboard";
}

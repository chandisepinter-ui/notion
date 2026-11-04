"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/client";
import { assertPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";

export type AdminResult = { ok: boolean; error?: string };

const RoleInput = z.object({ userId: z.string().min(1).max(64), roleKey: z.string().min(1).max(40), enabled: z.boolean() });

/** Grants or removes a role. Every change is written to the audit log. */
export async function setUserRole(input: { userId: string; roleKey: string; enabled: boolean }): Promise<AdminResult> {
  try {
    const actor = await assertPermission(PERMISSIONS.ADMIN_USERS_MANAGE);
    const { userId, roleKey, enabled } = RoleInput.parse(input);
    const role = await db.query.roles.findFirst({ where: eq(schema.roles.key, roleKey) });
    if (!role) return { ok: false, error: "Unknown role." };
    if (!enabled && userId === actor.id && roleKey === "ADMINISTRATOR") {
      return { ok: false, error: "You cannot remove your own Administrator role." };
    }
    if (enabled) {
      await db.insert(schema.userRoles).values({ userId, roleId: role.id }).onConflictDoNothing();
    } else {
      const remaining = await db.select().from(schema.userRoles).where(eq(schema.userRoles.userId, userId));
      if (remaining.length <= 1) return { ok: false, error: "Every account needs at least one role." };
      await db.delete(schema.userRoles).where(and(eq(schema.userRoles.userId, userId), eq(schema.userRoles.roleId, role.id)));
    }
    await db.insert(schema.auditLog).values({
      actorId: actor.id,
      action: enabled ? "role.grant" : "role.revoke",
      targetType: "user",
      targetId: userId,
      detailJson: JSON.stringify({ role: roleKey }),
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update the role." };
  }
}

const AssignInput = z.object({ supervisorId: z.string().min(1).max(64), traineeId: z.string().min(1).max(64), assigned: z.boolean() });

export async function setAssignment(input: { supervisorId: string; traineeId: string; assigned: boolean }): Promise<AdminResult> {
  try {
    const actor = await assertPermission(PERMISSIONS.ADMIN_USERS_MANAGE);
    const { supervisorId, traineeId, assigned } = AssignInput.parse(input);
    if (supervisorId === traineeId) return { ok: false, error: "A person cannot supervise themselves." };
    if (assigned) await db.insert(schema.supervisorAssignments).values({ supervisorId, traineeId }).onConflictDoNothing();
    else await db.delete(schema.supervisorAssignments).where(and(eq(schema.supervisorAssignments.supervisorId, supervisorId), eq(schema.supervisorAssignments.traineeId, traineeId)));
    await db.insert(schema.auditLog).values({ actorId: actor.id, action: assigned ? "assignment.add" : "assignment.remove", targetType: "user", targetId: traineeId, detailJson: JSON.stringify({ supervisorId }) });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update the assignment." };
  }
}

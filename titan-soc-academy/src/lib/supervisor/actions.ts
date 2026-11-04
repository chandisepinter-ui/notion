"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db/client";
import { assertPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { canSupervisorSee } from "@/lib/academy/queries";

const NoteInput = z.object({
  traineeId: z.string().min(1).max(64),
  category: z.enum(["REMEDIATION", "OBSERVATION", "COMMENDATION"]),
  moduleKey: z.string().max(80).optional().or(z.literal("")),
  body: z.string().trim().min(5, "Write at least a short sentence.").max(4000),
});

export type NoteState = { ok: boolean; error?: string; savedAt?: number };

export async function addSupervisorNote(_prev: NoteState, formData: FormData): Promise<NoteState> {
  try {
    const user = await assertPermission(PERMISSIONS.SUPERVISOR_NOTES_WRITE);
    const parsed = NoteInput.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    const { traineeId, category, moduleKey, body } = parsed.data;
    const viewAll = user.permissions.has(PERMISSIONS.SUPERVISOR_TRAINEES_VIEW_ALL);
    if (!(await canSupervisorSee(user.id, traineeId, viewAll))) return { ok: false, error: "This trainee is not assigned to you." };
    await db.insert(schema.supervisorNotes).values({ traineeId, authorId: user.id, category, moduleKey: moduleKey || null, body });
    await db.insert(schema.auditLog).values({ actorId: user.id, action: "supervisor_note.create", targetType: "user", targetId: traineeId, detailJson: JSON.stringify({ category }) });
    revalidatePath(`/supervisor/trainees/${traineeId}`);
    return { ok: true, savedAt: Date.now() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the note." };
  }
}

"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db/client";
import { assertPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getTitanCatalog } from "@/content/titan-catalog";

const Input = z.object({
  conflictId: z.string().regex(/^C\d{2}$/),
  choice: z.enum(["A", "B", "CUSTOM", "NOT_APPLICABLE"]),
  ruling: z.string().trim().min(10, "Write the ruling in at least one full sentence.").max(2000),
});

export type DecisionState = { ok: boolean; error?: string; savedAt?: number };

/** Records an owner ruling on a source conflict. Append-only; the newest ruling is current. */
export async function recordDecision(_prev: DecisionState, form: FormData): Promise<DecisionState> {
  try {
    const user = await assertPermission(PERMISSIONS.CONTENT_DECIDE);
    const parsed = Input.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    const { conflictId, choice, ruling } = parsed.data;
    if (!getTitanCatalog()?.conflicts.some((c) => c.id === conflictId)) return { ok: false, error: "Unknown conflict." };
    await db.insert(schema.contentDecisions).values({ conflictId, choice, ruling, decidedById: user.id });
    await db.insert(schema.auditLog).values({
      actorId: user.id,
      action: "content_decision.record",
      targetType: "conflict",
      targetId: conflictId,
      detailJson: JSON.stringify({ choice }),
    });
    revalidatePath("/admin/decisions");
    revalidatePath("/admin/curriculum");
    return { ok: true, savedAt: Date.now() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the decision." };
  }
}

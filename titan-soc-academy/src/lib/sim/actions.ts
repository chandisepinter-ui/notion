"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/client";
import { assertPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { applyAction, SimError } from "./engine";
import { parseCourseState } from "@/lib/course/engine";
import { createRun, loadRun, runView, score, type RunMode, type RunView } from "./service";
import type { SimAction } from "./types";

const id = z.string().min(1).max(40);
const at = z.number().finite().min(0).max(24 * 3600);
const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("OPEN_ALERT"), alertId: id, at }),
  z.object({ type: z.literal("BACK_TO_QUEUE"), alertId: id, at }),
  z.object({ type: z.literal("CLIP_SEGMENT"), alertId: id, phase: z.enum(["pre", "post"]), from: z.number().min(0).max(600), to: z.number().min(0).max(600), rate: z.number().min(0.25).max(4), at }),
  z.object({ type: z.literal("TAB_VIEWED"), alertId: id, tab: z.string().max(30), at }),
  z.object({ type: z.literal("DETAILS_VIEWED"), alertId: id, at }),
  z.object({ type: z.literal("CAMERA_VIEWED"), alertId: id, cameraId: z.string().max(60), at }),
  z.object({ type: z.literal("MULTIVIEW_OPEN"), alertId: id, at }),
  z.object({ type: z.literal("MULTIVIEW_CLOSE"), alertId: id, at }),
  z.object({ type: z.literal("PLAY_TALKDOWN"), alertId: id, cameraId: z.string().max(60), script: z.string().max(1000), usedSiteScript: z.boolean(), at }),
  z.object({ type: z.literal("CALL_START"), alertId: id, contactId: z.string().max(40), at }),
  z.object({ type: z.literal("PARK"), alertId: id, minutes: z.number().int().min(0).max(1440), note: z.string().max(250), at }),
  z.object({ type: z.literal("CLOSE"), alertId: id, outcome: z.string().max(80), subOutcome: z.string().max(80).optional(), note: z.string().max(5000), at }),
  z.object({ type: z.literal("RAISE"), alertId: id, group: z.string().max(80), at }),
  z.object({ type: z.literal("AUDIT_NOTE"), alertId: id, kind: z.string().max(40), note: z.string().max(2000), at }),
  z.object({ type: z.literal("NOTIFICATION"), alertId: id, contactType: z.enum(["Subscriber", "Police", "Fire Dept"]), contactId: z.string().max(40).optional(), result: z.enum(["No Answer", "Call Made"]), details: z.string().max(2000), at }),
  z.object({ type: z.literal("ADD_PROBLEM"), alertId: id, title: z.string().min(1).max(200), text: z.string().min(1).max(2000), at }),
  z.object({ type: z.literal("DISARM_SITE"), alertId: id, at }),
  z.object({ type: z.literal("ACK_ALARMS"), alertId: id, at }),
  z.object({ type: z.literal("ADD_NOTE"), alertId: id, note: z.string().min(1).max(2000), validFrom: z.string().max(40).optional(), validTo: z.string().max(40).optional(), at }),
  z.object({ type: z.literal("ADVANCE_TIME"), seconds: z.number().int().min(1).max(3600), at }),
]);

export type SimActionResult = { ok: true; view: RunView } | { ok: false; error: string; view?: RunView };

/** Starts a run and opens the workstation. Practice runs are open to everyone with Academy access. */
export async function startSimRun(form: FormData) {
  const user = await assertPermission(PERMISSIONS.ACADEMY_ACCESS);
  const scenarioId = String(form.get("scenarioId") ?? "").slice(0, 40);
  const modeRaw = String(form.get("mode") ?? "practice");
  const mode: RunMode = modeRaw === "guided" || modeRaw === "mastery" ? modeRaw : "practice";
  const moduleKey = (String(form.get("moduleKey") ?? "") || null)?.slice(0, 40) ?? null;
  const runId = await createRun(user.id, scenarioId, mode, moduleKey);
  redirect(`/sim/${runId}`);
}

/** Applies a batch of operator actions in order and saves the run. */
export async function sendSimActions(runId: string, actions: unknown[]): Promise<SimActionResult> {
  const user = await assertPermission(PERMISSIONS.ACADEMY_ACCESS);
  const loaded = await loadRun(String(runId).slice(0, 40), user.id);
  if (!loaded) return { ok: false, error: "Simulator run not found." };
  if (loaded.run.status !== "IN_PROGRESS") return { ok: false, error: "This run is already finished.", view: runView(loaded.run, loaded.entry, loaded.state) };
  let state = loaded.state;
  let error: string | null = null;
  for (const raw of actions.slice(0, 50)) {
    const parsed = ActionSchema.safeParse(raw);
    if (!parsed.success) { error = "Invalid action."; break; }
    try {
      state = applyAction(loaded.entry.scenario, loaded.entry.config, state, parsed.data as SimAction);
    } catch (e) {
      if (e instanceof SimError) { error = e.message; break; }
      throw e;
    }
  }
  await db.update(schema.simRuns).set({ stateJson: JSON.stringify(state), updatedAt: new Date() }).where(eq(schema.simRuns.id, loaded.run.id));
  const view = runView(loaded.run, loaded.entry, state);
  return error ? { ok: false, error, view } : { ok: true, view };
}

/** Scores the run. Results (with the scenario rationale) are revealed only now. */
export async function finishSimRun(runId: string): Promise<SimActionResult> {
  const user = await assertPermission(PERMISSIONS.ACADEMY_ACCESS);
  const loaded = await loadRun(String(runId).slice(0, 40), user.id);
  if (!loaded) return { ok: false, error: "Simulator run not found." };
  if (loaded.run.status === "COMPLETED") return { ok: true, view: runView(loaded.run, loaded.entry, loaded.state) };
  const state = { ...loaded.state, finished: true };
  const result = score(loaded.entry, state);
  const now = new Date();
  await db
    .update(schema.simRuns)
    .set({ status: "COMPLETED", stateJson: JSON.stringify(state), resultJson: JSON.stringify(result), scorePercent: result.scorePercent, passed: result.passed, completedAt: now, updatedAt: now })
    .where(and(eq(schema.simRuns.id, loaded.run.id), eq(schema.simRuns.userId, user.id)));
  // Runs launched from an Academy module also appear in that module's training history,
  // and are recorded in the learner's module progress (practice step / mastery evidence).
  const mod = loaded.run.moduleKey ? await db.query.modules.findFirst({ where: eq(schema.modules.key, loaded.run.moduleKey) }) : null;
  if (mod && mod.format === "course") {
    const prog = await db.query.moduleProgress.findFirst({ where: and(eq(schema.moduleProgress.userId, user.id), eq(schema.moduleProgress.moduleId, mod.id)) });
    if (prog) {
      const cs = parseCourseState(prog.stateJson);
      const prev = cs.sims?.[loaded.run.scenarioId] ?? {};
      cs.sims = {
        ...(cs.sims ?? {}),
        [loaded.run.scenarioId]: {
          ...prev,
          guidedDone: prev.guidedDone || loaded.run.mode !== "mastery",
          masteryPassed: prev.masteryPassed || (loaded.run.mode === "mastery" && result.passed),
          lastScore: result.scorePercent,
          lastPassed: result.passed,
        },
      };
      await db.update(schema.moduleProgress).set({ stateJson: JSON.stringify(cs), updatedAt: now }).where(eq(schema.moduleProgress.id, prog.id));
    }
  }
  if (mod) {
    await db.insert(schema.trainingAttempts).values({
      userId: user.id,
      moduleId: mod.id,
      stepId: `SIM:${loaded.run.scenarioId}`,
      itemId: loaded.run.scenarioId,
      stage: loaded.run.mode === "mastery" ? "verify" : "practice",
      tryNumber: 1,
      responseJson: JSON.stringify({ action: `Simulator ${loaded.run.mode}: ${result.scorePercent}% · ${result.criticalFailures} critical` }),
      isCorrect: result.passed,
      isCritical: result.criticalFailures > 0,
      evidenceComplete: true,
    });
  }
  return { ok: true, view: runView({ ...loaded.run, status: "COMPLETED", resultJson: JSON.stringify(result) }, loaded.entry, state) };
}


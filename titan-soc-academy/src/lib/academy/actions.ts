"use server";
/**
 * Server actions for the lesson player. Every action:
 *  1. checks the signed-in user's permission,
 *  2. loads the module content + the user's saved state,
 *  3. runs the pure engine,
 *  4. saves the result and returns a fresh SANITIZED view.
 */
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import * as engine from "./engine";
import { loadLesson, persistLesson } from "./service";
import { buildLessonView, type LessonView } from "./view";
import type { AttemptRecord, CompetencyChange, EvidenceKey, Feedback, ItemResponse, LessonState } from "./types";

export type LessonActionResult =
  | { ok: true; view: LessonView; feedback?: Feedback }
  | { ok: false; error: string; code?: string };

type Op = (ctx: { content: NonNullable<Awaited<ReturnType<typeof loadLesson>>>["content"]; state: LessonState }) => {
  state: LessonState;
  attempts?: AttemptRecord[];
  changes?: CompetencyChange[];
  feedback?: Feedback;
  scorePercent?: number;
};

async function run(moduleKey: string, op: Op): Promise<LessonActionResult> {
  try {
    const user = await assertPermission(PERMISSIONS.ACADEMY_ACCESS);
    const loaded = await loadLesson(user.id, moduleKey);
    if (!loaded) return { ok: false, error: "This module is not available." };
    const out = op({ content: loaded.content, state: loaded.state });
    await persistLesson({
      userId: user.id,
      content: loaded.content,
      moduleId: loaded.row.id,
      state: out.state,
      attempts: out.attempts,
      changes: out.changes,
      scorePercent: out.scorePercent,
    });
    revalidatePath("/dashboard");
    return { ok: true, view: buildLessonView(loaded.content, out.state), feedback: out.feedback };
  } catch (e) {
    if (e instanceof engine.LessonError) return { ok: false, error: e.message, code: e.code };
    console.error("[lesson action]", e);
    return { ok: false, error: e instanceof Error && e.message.startsWith("You") ? e.message : "Something went wrong saving your progress. Please try again." };
  }
}

const EVIDENCE_KEYS: EvidenceKey[] = ["clip", "overview", "schedule", "plan", "contacts"];
const asText = (v: unknown, max = 64) => (typeof v === "string" ? v.slice(0, max) : "");
const asResponse = (r: unknown): ItemResponse => {
  const o = (r ?? {}) as Record<string, unknown>;
  return { action: asText(o.action) || undefined, rule: asText(o.rule) || undefined };
};

export async function continueLesson(moduleKey: string) {
  return run(moduleKey, ({ content, state }) => engine.advance(content, state));
}

export async function walkthroughBack(moduleKey: string) {
  return run(moduleKey, ({ content, state }) => ({ state: engine.walkthroughBack(content, state) }));
}

export async function openEvidence(moduleKey: string, stepId: string, itemId: string, key: string) {
  const k = key as EvidenceKey;
  if (!EVIDENCE_KEYS.includes(k)) return { ok: false, error: "Unknown evidence." } as LessonActionResult;
  return run(moduleKey, ({ content, state }) => ({ state: engine.recordEvidence(content, state, asText(stepId), asText(itemId), k) }));
}

export async function showHint(moduleKey: string, stepId: string) {
  return run(moduleKey, ({ content, state }) => ({ state: engine.revealHint(content, state, asText(stepId)) }));
}

export async function submitAnswer(moduleKey: string, stepId: string, itemId: string, response: unknown) {
  return run(moduleKey, ({ content, state }) => {
    const r = engine.answerItem(content, state, asText(stepId), asText(itemId), asResponse(response));
    return { state: r.state, attempts: [r.attempt], changes: r.changes, feedback: r.feedback };
  });
}

export async function saveAssessmentAnswer(moduleKey: string, itemId: string, response: unknown) {
  return run(moduleKey, ({ content, state }) => ({ state: engine.saveDraft(content, state, asText(itemId), asResponse(response)) }));
}

export async function submitVerification(moduleKey: string) {
  return run(moduleKey, ({ content, state }) => {
    const r = engine.submitAssessment(content, state);
    return { state: r.state, attempts: r.attempts, changes: r.changes, scorePercent: r.result.scorePercent };
  });
}

export async function completeRemediationReview(moduleKey: string) {
  return run(moduleKey, ({ content, state }) => ({ state: engine.acknowledgeRemediation(content, state) }));
}

export async function beginRetake(moduleKey: string) {
  return run(moduleKey, ({ content, state }) => ({ state: engine.startRetake(content, state) }));
}

"use server";
/**
 * Server actions for imported Titan course modules. Mirrors the lesson actions:
 * check permission → load content + saved state → run pure engine → save →
 * return a fresh sanitized view.
 */
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { courseViewFor, loadCourse, playableSimIds } from "./service";
import { walkthroughsFor } from "./walkthroughs";
import { persistProgress } from "@/lib/academy/service";
import type { AttemptRecord, CompetencyChange } from "@/lib/academy/types";
import * as engine from "./engine";
import type { CourseModule, CourseState, QuestionFeedback } from "./types";
import type { CourseView } from "./view";

export type CourseActionResult = { ok: true; view: CourseView; feedback?: QuestionFeedback } | { ok: false; error: string };

type Op = (c: CourseModule, s: CourseState) => {
  state: CourseState;
  attempts?: AttemptRecord[];
  changes?: CompetencyChange[];
  feedback?: QuestionFeedback;
  scorePercent?: number;
};

async function run(key: string, op: Op): Promise<CourseActionResult> {
  try {
    const user = await assertPermission(PERMISSIONS.ACADEMY_ACCESS);
    const loaded = await loadCourse(user.id, String(key).slice(0, 40), user.permissions.has(PERMISSIONS.ACADEMY_PREVIEW_ALL));
    if (!loaded) return { ok: false, error: "This module is not available." };
    if (loaded.locked) return { ok: false, error: "Complete the earlier modules first." };
    const out = op(loaded.content, loaded.state);
    await persistProgress({
      userId: user.id,
      moduleId: loaded.row.id,
      status: out.state.status,
      stepIndex: out.state.stepIndex,
      stateJson: JSON.stringify(out.state),
      contentVersion: 1,
      assessmentAttempts: out.state.mastery.history.length,
      attempts: out.attempts,
      changes: out.changes,
      scorePercent: out.scorePercent,
    });
    revalidatePath("/dashboard");
    return { ok: true, view: await courseViewFor(loaded.content, out.state), feedback: out.feedback };
  } catch (e) {
    if (e instanceof engine.LessonError) return { ok: false, error: e.message };
    console.error("[course action]", e);
    return { ok: false, error: e instanceof Error && e.message.startsWith("You") ? e.message : "Something went wrong saving your progress. Please try again." };
  }
}

const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 80) : "");

export async function courseContinue(key: string) {
  return run(key, (c, s) => engine.advanceCourse(c, s, { playable: playableSimIds() }));
}
export async function courseBack(key: string) {
  return run(key, (c, s) => ({ state: engine.backCourse(c, s) }));
}
export async function coursePracticeAnswer(key: string, stepId: string, itemId: string, response: unknown) {
  return run(key, (c, s) => {
    const r = engine.answerPractice(c, s, str(stepId), str(itemId), response);
    return { state: r.state, attempts: [r.attempt], feedback: r.feedback };
  });
}
export async function courseSaveMastery(key: string, itemId: string, response: unknown) {
  return run(key, (c, s) => ({ state: engine.saveMasteryAnswer(c, s, str(itemId), response) }));
}
export async function courseSubmitMastery(key: string) {
  return run(key, (c, s) => {
    const r = engine.submitMastery(c, s, Date.now(), { playable: playableSimIds() });
    return { state: r.state, attempts: r.attempts, changes: r.changes, scorePercent: r.result.scorePercent };
  });
}
export async function courseReviewed(key: string) {
  return run(key, (_c, s) => ({ state: engine.acknowledgeCourseRemediation(s) }));
}
export async function courseRetest(key: string) {
  return run(key, (c, s) => ({ state: engine.startRetest(c, s) }));
}
export async function courseWalkthroughDone(key: string, stepId: string, walkthroughId: string, misses: number) {
  return run(key, (c, s) => ({
    state: engine.recordWalkthrough(c, s, str(stepId), str(walkthroughId), Number(misses), new Set(walkthroughsFor(c.key).map((w) => w.id)), Date.now()),
  }));
}

/**
 * Course engine — pure functions for imported "course" modules.
 * Same guarantees as the IMMIX lesson engine: answers are graded here (server),
 * answer keys never reach the browser before grading, every graded answer is
 * returned as an attempt record, and competency changes are explicit.
 */
import { LessonError } from "@/lib/academy/engine";
import type { AttemptRecord, CompetencyChange } from "@/lib/academy/types";
import type { CourseModule, CourseState, CourseStep, MasteryResult, Question, QuestionFeedback } from "./types";

export { LessonError };

export function initialCourseState(): CourseState {
  return {
    stepIndex: 0,
    completedSteps: [],
    status: "IN_PROGRESS",
    cardIndex: {},
    practice: {},
    mastery: { attempt: 1, draft: {}, history: [], remediationReviewed: false },
  };
}

export function parseCourseState(json: string | null | undefined): CourseState {
  const base = initialCourseState();
  if (!json) return base;
  try {
    const p = JSON.parse(json) as Partial<CourseState>;
    return { ...base, ...p, mastery: { ...base.mastery, ...(p.mastery ?? {}) } };
  } catch {
    return base;
  }
}

const clone = <T,>(v: T): T => structuredClone(v);

export function currentCourseStep(mod: CourseModule, s: CourseState): CourseStep {
  return mod.steps[Math.min(s.stepIndex, mod.steps.length - 1)];
}

/* ------------------------------------------------------------------ */
/* Option display order                                                */
/* ------------------------------------------------------------------ */

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Deterministic display order. Attempt 1 uses the authored order; retests
 * reshuffle so a learner cannot pass by remembering positions.
 */
export function displayOrder(q: Question, attempt: number): number[] {
  const idx = q.options.map((_, i) => i);
  if (attempt <= 1 && q.type !== "order") return idx;
  let seed = hash(`${q.id}:${attempt}`);
  for (let i = idx.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = seed % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/* ------------------------------------------------------------------ */
/* Grading                                                             */
/* ------------------------------------------------------------------ */

export function validResponse(q: Question, r: unknown): r is number[] {
  if (!Array.isArray(r) || r.some((x) => !Number.isInteger(x) || x < 0 || x >= q.options.length)) return false;
  if (new Set(r).size !== r.length) return false;
  if (q.type === "mcq") return r.length === 1;
  if (q.type === "order") return r.length === q.options.length;
  return r.length >= 1;
}

export function isCorrect(q: Question, r: number[]): boolean {
  if (q.type === "order") return r.length === q.answer.length && r.every((v, i) => v === q.answer[i]);
  const a = [...q.answer].sort((x, y) => x - y);
  const b = [...r].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const labels = (q: Question, r: number[]) => r.map((i) => q.options[i]);
/** Human-readable answer stored with each attempt (for history and supervisor review). */
export const answerText = (q: Question, r: number[]) => labels(q, r).join(q.type === "order" ? " → " : " | ");

function feedbackFor(q: Question, r: number[], revealAnswer: boolean): QuestionFeedback {
  const correct = isCorrect(q, r);
  return {
    correct,
    critical: !correct && q.critical,
    explanation: q.explanation,
    correctAnswer: correct || revealAnswer ? labels(q, q.answer) : [],
  };
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

function complete(mod: CourseModule, s: CourseState) {
  const step = currentCourseStep(mod, s);
  if (!s.completedSteps.includes(step.id)) s.completedSteps.push(step.id);
  if (s.stepIndex < mod.steps.length - 1) s.stepIndex += 1;
}

function practiceState(s: CourseState, stepId: string) {
  return (s.practice[stepId] ??= { position: 0, items: {} });
}

export function canAdvanceCourse(mod: CourseModule, s: CourseState): boolean {
  const step = currentCourseStep(mod, s);
  switch (step.kind) {
    case "practice": {
      const p = s.practice[step.id];
      const item = step.items[p?.position ?? 0];
      return !!p?.items[item.id]?.solved;
    }
    case "mastery":
    case "supervisor-gate":
      return false;
    case "pending-source":
      return s.status !== "PENDING_SOURCE";
    default:
      return true;
  }
}

export function advanceCourse(mod: CourseModule, input: CourseState): { state: CourseState; changes: CompetencyChange[] } {
  const s = clone(input);
  const step = currentCourseStep(mod, s);
  const changes: CompetencyChange[] = [];
  if (!canAdvanceCourse(mod, s)) throw new LessonError("NOT_COMPLETE", "Finish this part before continuing.");
  switch (step.kind) {
    case "cards": {
      const i = s.cardIndex[step.id] ?? 0;
      if (i < step.cards.length - 1) {
        s.cardIndex[step.id] = i + 1;
        return { state: s, changes };
      }
      changes.push({ key: mod.key, level: "LEARNING", reason: "Completed the learn cards." });
      break;
    }
    case "practice": {
      const p = practiceState(s, step.id);
      if (p.position < step.items.length - 1) {
        p.position += 1;
        return { state: s, changes };
      }
      changes.push({ key: mod.key, level: "ASSISTED", reason: "Completed guided practice." });
      break;
    }
    case "pending-source":
      s.status = "PENDING_SOURCE";
      if (!s.completedSteps.includes(step.id)) s.completedSteps.push(step.id);
      return { state: s, changes };
  }
  complete(mod, s);
  return { state: s, changes };
}

export function backCourse(mod: CourseModule, input: CourseState): CourseState {
  const s = clone(input);
  const step = currentCourseStep(mod, s);
  if (step.kind === "cards" && (s.cardIndex[step.id] ?? 0) > 0) s.cardIndex[step.id] -= 1;
  else if (step.kind === "practice" && (s.practice[step.id]?.position ?? 0) > 0) s.practice[step.id].position -= 1;
  else if (s.stepIndex > 0 && step.kind !== "mastery") s.stepIndex -= 1;
  else throw new LessonError("NOT_ALLOWED", "You are at the start.");
  return s;
}

/* ------------------------------------------------------------------ */
/* Practice (ungraded, immediate feedback)                             */
/* ------------------------------------------------------------------ */

export function answerPractice(
  mod: CourseModule,
  input: CourseState,
  stepId: string,
  itemId: string,
  response: unknown,
): { state: CourseState; feedback: QuestionFeedback; attempt: AttemptRecord } {
  const s = clone(input);
  const step = currentCourseStep(mod, s);
  if (step.id !== stepId || step.kind !== "practice") throw new LessonError("WRONG_STEP", "That step is not active.");
  const p = practiceState(s, step.id);
  const q = step.items[p.position];
  if (q.id !== itemId) throw new LessonError("WRONG_ITEM", "That question is not active.");
  if (!validResponse(q, response)) throw new LessonError("INVALID_RESPONSE", q.type === "order" ? "Put every step in order before checking." : "Choose an answer.");
  const st = (p.items[q.id] ??= { tries: 0, solved: false });
  if (st.solved) throw new LessonError("ALREADY_SOLVED", "Already answered.");
  st.tries += 1;
  // After two misses, show the correct answer so the learner is never stuck.
  const fb = feedbackFor(q, response, st.tries >= 2);
  st.solved = fb.correct || st.tries >= 3;
  st.last = response;
  st.feedback = fb;
  return {
    state: s,
    feedback: fb,
    attempt: { stepId, itemId, stage: step.stage, tryNumber: st.tries, response: { action: answerText(q, response) }, isCorrect: fb.correct, isCritical: false, evidenceComplete: true },
  };
}

/* ------------------------------------------------------------------ */
/* Mastery (graded; answers revealed after submission)                 */
/* ------------------------------------------------------------------ */

function openMastery(mod: CourseModule, s: CourseState) {
  const step = currentCourseStep(mod, s);
  if (step.kind !== "mastery") throw new LessonError("WRONG_STEP", "The mastery check is not active.");
  if (s.mastery.result) throw new LessonError("NOT_ALLOWED", "This attempt has already been submitted.");
  return step;
}

export function saveMasteryAnswer(mod: CourseModule, input: CourseState, itemId: string, response: unknown): CourseState {
  const s = clone(input);
  const step = openMastery(mod, s);
  const q = step.items.find((i) => i.id === itemId);
  if (!q) throw new LessonError("WRONG_ITEM", "Unknown question.");
  if (!Array.isArray(response) || response.some((x) => !Number.isInteger(x) || x < 0 || x >= q.options.length)) {
    throw new LessonError("INVALID_RESPONSE", "Invalid answer.");
  }
  s.mastery.draft[itemId] = response as number[];
  return s;
}

export function submitMastery(
  mod: CourseModule,
  input: CourseState,
  now = Date.now(),
): { state: CourseState; result: MasteryResult; attempts: AttemptRecord[]; changes: CompetencyChange[] } {
  const s = clone(input);
  const step = openMastery(mod, s);
  for (const q of step.items) {
    if (!validResponse(q, s.mastery.draft[q.id])) throw new LessonError("INCOMPLETE_ASSESSMENT", "Answer every question before submitting.");
  }
  let earned = 0;
  let possible = 0;
  let correctCount = 0;
  let criticalErrors = 0;
  const attempts: AttemptRecord[] = [];
  const items = step.items.map((q) => {
    const r = s.mastery.draft[q.id];
    const ok = isCorrect(q, r);
    if (q.graded) {
      possible += q.weight;
      if (ok) {
        earned += q.weight;
        correctCount += 1;
      } else if (q.critical) criticalErrors += 1;
    }
    attempts.push({
      stepId: step.id,
      itemId: q.id,
      stage: "verify",
      tryNumber: 1,
      assessmentAttempt: s.mastery.attempt,
      response: { action: answerText(q, r) },
      isCorrect: ok,
      isCritical: q.graded && !ok && q.critical,
      misconception: ok ? undefined : q.graded ? undefined : "not-scored",
      evidenceComplete: true,
    });
    return {
      id: q.id,
      prompt: q.prompt,
      graded: q.graded,
      correct: ok,
      critical: q.graded && !ok && q.critical,
      chosen: labels(q, r),
      correctAnswer: labels(q, q.answer),
      explanation: q.explanation,
      conflictId: q.conflictId,
    };
  });
  const gradedCount = step.items.filter((q) => q.graded).length;
  const scorePercent = possible ? Math.round((earned / possible) * 100) : 0;
  const passed = gradedCount > 0 && scorePercent >= step.passPercent && criticalErrors === 0;
  const result: MasteryResult = { attempt: s.mastery.attempt, scorePercent, correctCount, gradedCount, criticalErrors, passed, submittedAt: now, items };
  s.mastery.result = result;
  s.mastery.history.push({ attempt: result.attempt, scorePercent, passed, submittedAt: now });
  s.mastery.remediationReviewed = false;
  const changes: CompetencyChange[] = [];
  if (passed) {
    s.status = "PASSED";
    if (!s.completedSteps.includes(step.id)) s.completedSteps.push(step.id);
    changes.push({ key: mod.key, level: "MASTERY_DEMONSTRATED", reason: `Passed mastery check (attempt ${result.attempt}, ${scorePercent}%).` });
  } else {
    s.status = "REMEDIATION";
    changes.push({ key: mod.key, level: "REMEDIATION", reason: `Mastery attempt ${result.attempt} not passed (${scorePercent}%, ${criticalErrors} critical).` });
  }
  return { state: s, result, attempts, changes };
}

export function acknowledgeCourseRemediation(input: CourseState): CourseState {
  const s = clone(input);
  if (s.status !== "REMEDIATION") throw new LessonError("NOT_ALLOWED", "No remediation is pending.");
  s.mastery.remediationReviewed = true;
  return s;
}

export function startRetest(mod: CourseModule, input: CourseState): CourseState {
  const s = clone(input);
  if (s.status !== "REMEDIATION" || currentCourseStep(mod, s).kind !== "mastery") throw new LessonError("NOT_ALLOWED", "A retest is not available.");
  if (!s.mastery.remediationReviewed) throw new LessonError("NOT_ALLOWED", "Review the remediation material first.");
  s.mastery = { ...s.mastery, attempt: s.mastery.attempt + 1, draft: {}, result: undefined, remediationReviewed: false };
  s.status = "IN_PROGRESS";
  return s;
}

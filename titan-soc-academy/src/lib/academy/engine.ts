/**
 * Lesson engine — pure functions, no database, no UI.
 *
 * Given a module's content and a learner's saved state, these functions decide
 * what is allowed, grade answers, produce feedback, and report competency
 * changes. Because it is pure, it is unit-tested directly (tests/unit).
 *
 * Security rule: answer keys never leave this file except inside feedback for
 * an attempt that has already been graded. See view.ts for the sanitized view.
 */
import type {
  AssessmentResult,
  AssessmentStep,
  AttemptRecord,
  CompetencyChange,
  DecisionItem,
  EvidenceKey,
  Feedback,
  ItemResponse,
  ItemState,
  LessonModule,
  LessonState,
  LessonStep,
  PracticeStep,
} from "./types";

export class LessonError extends Error {
  constructor(
    public code:
      | "WRONG_STEP"
      | "WRONG_ITEM"
      | "EVIDENCE_REQUIRED"
      | "INVALID_RESPONSE"
      | "ALREADY_SOLVED"
      | "NOT_COMPLETE"
      | "INCOMPLETE_ASSESSMENT"
      | "NOT_ALLOWED",
    message: string,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const itemKey = (stepId: string, itemId: string) => `${stepId}:${itemId}`;

export function initialState(): LessonState {
  return {
    stepIndex: 0,
    completedSteps: [],
    status: "IN_PROGRESS",
    items: {},
    walkthrough: {},
    practice: {},
    misconceptions: {},
    assessment: { attempt: 0, itemIds: [], draft: {}, evidence: {}, history: [], remediationReviewed: false },
  };
}

/** Defensive parse of stored JSON (older or damaged rows fall back to a fresh start). */
export function parseState(json: string | null | undefined): LessonState {
  const base = initialState();
  if (!json) return base;
  try {
    const parsed = JSON.parse(json) as Partial<LessonState>;
    return {
      ...base,
      ...parsed,
      assessment: { ...base.assessment, ...(parsed.assessment ?? {}) },
    };
  } catch {
    return base;
  }
}

const clone = <T,>(v: T): T => structuredClone(v);

export function currentStep(mod: LessonModule, state: LessonState): LessonStep {
  return mod.steps[Math.min(state.stepIndex, mod.steps.length - 1)];
}

function emptyItemState(): ItemState {
  return { tries: 0, solved: false, firstTryCorrect: null, evidence: [], hintsShown: 0 };
}

export function assessmentItemsFor(step: AssessmentStep, attempt: number): DecisionItem[] {
  const a = Math.max(attempt, 1);
  return step.groups.map((variants) => variants[(a - 1) % variants.length]);
}

export function practiceProgress(state: LessonState, step: PracticeStep) {
  return state.practice[step.id] ?? { position: 0, firstTryCorrect: 0, reinforcement: false, done: false };
}

/** The item the learner is currently working on in a decision/practice step. */
export function activeItem(mod: LessonModule, state: LessonState): { step: LessonStep; item: DecisionItem } | null {
  const step = currentStep(mod, state);
  if (step.kind === "decision") return { step, item: step.item };
  if (step.kind === "practice") {
    const p = practiceProgress(state, step);
    const item = step.items[Math.min(p.position, step.items.length - 1)];
    return { step, item };
  }
  return null;
}

export function missingEvidence(required: EvidenceKey[], seen: EvidenceKey[]): EvidenceKey[] {
  return required.filter((k) => !seen.includes(k));
}

function allCompetencies(mod: LessonModule) {
  return mod.competencies.map((c) => c.key);
}

function completeCurrentStep(mod: LessonModule, state: LessonState) {
  const step = currentStep(mod, state);
  if (!state.completedSteps.includes(step.id)) state.completedSteps.push(step.id);
  if (state.stepIndex < mod.steps.length - 1) state.stepIndex += 1;
  const next = currentStep(mod, state);
  if (next.kind === "assessment" && state.assessment.attempt === 0) {
    state.assessment.attempt = 1;
    state.assessment.itemIds = assessmentItemsFor(next, 1).map((i) => i.id);
  }
}

/* ------------------------------------------------------------------ */
/* Grading                                                             */
/* ------------------------------------------------------------------ */

/** Default misconception for (correct action -> chosen action). */
const MISCONCEPTION_MATRIX: Record<string, Record<string, string>> = {
  "false-alarm": { authorized: "unverified-authorization", escalate: "over-escalation", monitor: "unresolved-alert" },
  authorized: { "false-alarm": "dismissed-human-activity", escalate: "over-escalation", monitor: "unresolved-alert" },
  escalate: { "false-alarm": "dismissed-human-activity", authorized: "unverified-authorization", monitor: "under-escalation" },
  monitor: { "false-alarm": "dismissed-human-activity", authorized: "unverified-authorization", escalate: "over-escalation" },
};

export type Grade = {
  actionCorrect: boolean;
  ruleCorrect: boolean;
  correct: boolean;
  critical: boolean;
  misconception?: string;
};

export function gradeItem(item: DecisionItem, response: ItemResponse): Grade {
  const actionCorrect = response.action === item.correctAction;
  const ruleCorrect = response.rule === item.correctRule;
  // Fictional training rule: failing to escalate when escalation is required is critical.
  const critical = item.correctAction === "escalate" && response.action !== "escalate";
  let misconception: string | undefined;
  if (!actionCorrect && response.action) {
    misconception =
      item.misconceptionFor?.[response.action] ?? MISCONCEPTION_MATRIX[item.correctAction]?.[response.action];
  } else if (actionCorrect && !ruleCorrect) {
    misconception = "rule-mismatch";
  }
  return { actionCorrect, ruleCorrect, correct: actionCorrect && ruleCorrect, critical, misconception };
}

function validateResponse(mod: LessonModule, item: DecisionItem, response: ItemResponse) {
  const scenario = mod.scenarios.find((s) => s.id === item.scenarioId);
  const site = mod.sites.find((s) => s.id === scenario?.siteId);
  const actionOk = mod.actions.some((a) => a.id === response.action);
  const ruleOk = !!site?.responsePlan.some((r) => r.id === response.rule);
  if (!actionOk || !ruleOk) throw new LessonError("INVALID_RESPONSE", "Choose one action and one supporting rule.");
}

export function buildFeedback(mod: LessonModule, item: DecisionItem, grade: Grade, repeatCount: number): Feedback {
  if (grade.correct) {
    return {
      correct: true,
      critical: false,
      headline: "Correct",
      message: "Your action and your supporting rule are both right.",
      explanation: item.explanation,
      actionCorrect: true,
      ruleCorrect: true,
    };
  }
  const m = mod.misconceptions.find((x) => x.key === grade.misconception);
  const primary = m?.explanations[0] ?? "Review the evidence and the site's instructions, then try again.";
  let alternate: Feedback["alternate"];
  if (m && repeatCount >= 2 && m.explanations.length > 1) {
    const idx = 1 + ((repeatCount - 2) % (m.explanations.length - 1));
    alternate = { title: "This mistake has come up before — here is another way to think about it", text: m.explanations[idx] };
  }
  const headline = grade.critical
    ? "Not correct — critical error in this exercise"
    : grade.actionCorrect
      ? "Right action, wrong reason"
      : "Not correct yet";
  return {
    correct: false,
    critical: grade.critical,
    headline,
    message: primary,
    alternate,
    misconception: m?.label,
    actionCorrect: grade.actionCorrect,
    ruleCorrect: grade.ruleCorrect,
  };
}

/* ------------------------------------------------------------------ */
/* Learner events                                                      */
/* ------------------------------------------------------------------ */

export function recordEvidence(
  mod: LessonModule,
  input: LessonState,
  stepId: string,
  itemId: string,
  key: EvidenceKey,
): LessonState {
  const state = clone(input);
  const step = currentStep(mod, state);
  if (step.id !== stepId) throw new LessonError("WRONG_STEP", "That step is not active.");
  if (step.kind === "assessment") {
    if (!state.assessment.itemIds.includes(itemId)) throw new LessonError("WRONG_ITEM", "That alert is not part of this attempt.");
    const seen = state.assessment.evidence[itemId] ?? [];
    if (!seen.includes(key)) state.assessment.evidence[itemId] = [...seen, key];
    return state;
  }
  const active = activeItem(mod, state);
  if (!active || active.item.id !== itemId) throw new LessonError("WRONG_ITEM", "That alert is not active.");
  const k = itemKey(stepId, itemId);
  const is = state.items[k] ?? emptyItemState();
  if (!is.evidence.includes(key)) is.evidence = [...is.evidence, key];
  state.items[k] = is;
  return state;
}

export function revealHint(mod: LessonModule, input: LessonState, stepId: string): LessonState {
  const state = clone(input);
  const step = currentStep(mod, state);
  if (step.id !== stepId || step.kind !== "decision" || step.stage !== "guide" || !step.item.hints?.length) {
    throw new LessonError("NOT_ALLOWED", "Hints are not available here.");
  }
  const k = itemKey(step.id, step.item.id);
  const is = state.items[k] ?? emptyItemState();
  is.hintsShown = Math.min(is.hintsShown + 1, step.item.hints.length);
  state.items[k] = is;
  return state;
}

export function answerItem(
  mod: LessonModule,
  input: LessonState,
  stepId: string,
  itemId: string,
  response: ItemResponse,
): { state: LessonState; feedback: Feedback; attempt: AttemptRecord; changes: CompetencyChange[] } {
  const state = clone(input);
  const active = activeItem(mod, state);
  if (!active || active.step.id !== stepId) throw new LessonError("WRONG_STEP", "That step is not active.");
  if (active.item.id !== itemId) throw new LessonError("WRONG_ITEM", "That alert is not active.");
  const { step, item } = active;
  const k = itemKey(step.id, item.id);
  const is = state.items[k] ?? emptyItemState();
  if (is.solved) throw new LessonError("ALREADY_SOLVED", "You have already completed this alert.");

  const missing = missingEvidence(item.requiredEvidence, is.evidence);
  if (missing.length) {
    throw new LessonError("EVIDENCE_REQUIRED", "Review all required evidence before deciding.");
  }
  validateResponse(mod, item, response);

  const grade = gradeItem(item, response);
  is.tries += 1;
  let repeat = 0;
  if (grade.correct) {
    is.solved = true;
    is.firstTryCorrect = is.tries === 1;
  } else if (grade.misconception) {
    repeat = (state.misconceptions[grade.misconception] ?? 0) + 1;
    state.misconceptions[grade.misconception] = repeat;
  }
  const feedback = buildFeedback(mod, item, grade, repeat);
  is.lastResponse = response;
  is.lastFeedback = feedback;
  state.items[k] = is;

  const changes: CompetencyChange[] = [];
  if (grade.correct && step.stage === "guide") {
    item.competencies.forEach((key) => changes.push({ key, level: "ASSISTED", reason: "Completed guided alert investigation." }));
  }
  if (grade.correct && step.stage === "challenge" && is.firstTryCorrect) {
    item.competencies.forEach((key) =>
      changes.push({ key, level: "PRACTICING", reason: "Solved the full challenge scenario on the first try." }),
    );
  }
  if (step.kind === "practice" && grade.correct) {
    const p = practiceProgress(state, step);
    state.practice[step.id] = { ...p, firstTryCorrect: p.firstTryCorrect + (is.firstTryCorrect ? 1 : 0) };
  }

  return {
    state,
    feedback,
    changes,
    attempt: {
      stepId: step.id,
      itemId: item.id,
      stage: step.stage,
      tryNumber: is.tries,
      response,
      isCorrect: grade.correct,
      isCritical: grade.critical,
      misconception: grade.misconception,
      evidenceComplete: true,
    },
  };
}

/** True when the learner may press "Continue" on the current step. */
export function canAdvance(mod: LessonModule, state: LessonState): boolean {
  const step = currentStep(mod, state);
  switch (step.kind) {
    case "briefing":
    case "walkthrough":
      return true;
    case "decision":
      return !!state.items[itemKey(step.id, step.item.id)]?.solved;
    case "practice": {
      const a = activeItem(mod, state);
      return !!a && !!state.items[itemKey(step.id, a.item.id)]?.solved;
    }
    case "assessment":
      return false;
  }
}

export function advance(mod: LessonModule, input: LessonState): { state: LessonState; changes: CompetencyChange[] } {
  const state = clone(input);
  const step = currentStep(mod, state);
  const changes: CompetencyChange[] = [];
  if (!canAdvance(mod, state)) throw new LessonError("NOT_COMPLETE", "Finish this part before continuing.");

  switch (step.kind) {
    case "briefing":
      allCompetencies(mod).forEach((key) => changes.push({ key, level: "LEARNING", reason: "Completed the concept briefing." }));
      completeCurrentStep(mod, state);
      break;
    case "walkthrough": {
      const pos = state.walkthrough[step.id] ?? 0;
      if (pos < step.panels.length - 1) state.walkthrough[step.id] = pos + 1;
      else completeCurrentStep(mod, state);
      break;
    }
    case "decision":
      completeCurrentStep(mod, state);
      break;
    case "practice": {
      const p = practiceProgress(state, step);
      if (p.firstTryCorrect >= step.requiredFirstTryCorrect) {
        state.practice[step.id] = { ...p, done: true };
        allCompetencies(mod).forEach((key) =>
          changes.push({ key, level: "PRACTICING", reason: `Practice: ${p.firstTryCorrect} alerts correct on the first try.` }),
        );
        completeCurrentStep(mod, state);
      } else if (p.position + 1 >= step.items.length) {
        state.practice[step.id] = { ...p, done: true, reinforcement: true };
        allCompetencies(mod).forEach((key) =>
          changes.push({ key, level: "ASSISTED", reason: "Practice completed; reinforcement recommended (first-try target not met)." }),
        );
        completeCurrentStep(mod, state);
      } else {
        state.practice[step.id] = { ...p, position: p.position + 1 };
      }
      break;
    }
  }
  return { state, changes };
}

export function walkthroughBack(mod: LessonModule, input: LessonState): LessonState {
  const state = clone(input);
  const step = currentStep(mod, state);
  if (step.kind !== "walkthrough") throw new LessonError("NOT_ALLOWED", "Not a walkthrough.");
  state.walkthrough[step.id] = Math.max(0, (state.walkthrough[step.id] ?? 0) - 1);
  return state;
}

/* ------------------------------------------------------------------ */
/* Assessment (VERIFY)                                                 */
/* ------------------------------------------------------------------ */

function requireOpenAssessment(mod: LessonModule, state: LessonState): AssessmentStep {
  const step = currentStep(mod, state);
  if (step.kind !== "assessment") throw new LessonError("WRONG_STEP", "The assessment is not active.");
  if (state.assessment.result) throw new LessonError("NOT_ALLOWED", "This attempt has already been submitted.");
  return step;
}

export function saveDraft(mod: LessonModule, input: LessonState, itemId: string, response: ItemResponse): LessonState {
  const state = clone(input);
  const step = requireOpenAssessment(mod, state);
  const item = assessmentItemsFor(step, state.assessment.attempt).find((i) => i.id === itemId);
  if (!item) throw new LessonError("WRONG_ITEM", "That alert is not part of this attempt.");
  if (missingEvidence(item.requiredEvidence, state.assessment.evidence[itemId] ?? []).length) {
    throw new LessonError("EVIDENCE_REQUIRED", "Review all required evidence before answering.");
  }
  const merged = { ...(state.assessment.draft[itemId] ?? {}), ...response };
  if (merged.action && !mod.actions.some((a) => a.id === merged.action)) throw new LessonError("INVALID_RESPONSE", "Unknown action.");
  state.assessment.draft[itemId] = merged;
  return state;
}

export function submitAssessment(
  mod: LessonModule,
  input: LessonState,
  now = Date.now(),
): { state: LessonState; result: AssessmentResult; attempts: AttemptRecord[]; changes: CompetencyChange[] } {
  const state = clone(input);
  const step = requireOpenAssessment(mod, state);
  const items = assessmentItemsFor(step, state.assessment.attempt);

  for (const it of items) {
    const d = state.assessment.draft[it.id];
    if (!d?.action || !d?.rule) throw new LessonError("INCOMPLETE_ASSESSMENT", "Answer every alert before submitting.");
    if (missingEvidence(it.requiredEvidence, state.assessment.evidence[it.id] ?? []).length) {
      throw new LessonError("EVIDENCE_REQUIRED", "Review the required evidence for every alert before submitting.");
    }
    validateResponse(mod, it, d);
  }

  const attempts: AttemptRecord[] = [];
  const missed = new Set<string>();
  const missedCompetencies = new Set<string>();
  const resultItems = items.map((it) => {
    const chosen = state.assessment.draft[it.id];
    const g = gradeItem(it, chosen);
    if (!g.correct) {
      if (g.misconception) missed.add(g.misconception);
      it.competencies.forEach((c) => missedCompetencies.add(c));
    }
    attempts.push({
      stepId: step.id,
      itemId: it.id,
      stage: "verify",
      tryNumber: 1,
      assessmentAttempt: state.assessment.attempt,
      response: chosen,
      isCorrect: g.correct,
      isCritical: g.critical,
      misconception: g.misconception,
      evidenceComplete: true,
    });
    const scenario = mod.scenarios.find((s) => s.id === it.scenarioId)!;
    const site = mod.sites.find((s) => s.id === scenario.siteId)!;
    return {
      itemId: it.id,
      scenarioId: it.scenarioId,
      correct: g.correct,
      critical: g.critical,
      chosen,
      correctActionLabel: mod.actions.find((a) => a.id === it.correctAction)?.label ?? it.correctAction,
      correctRuleLabel: site.responsePlan.find((r) => r.id === it.correctRule)?.title ?? it.correctRule,
      explanation: it.explanation,
      misconception: mod.misconceptions.find((m) => m.key === g.misconception)?.label,
    };
  });

  const correctCount = resultItems.filter((r) => r.correct).length;
  const scorePercent = Math.round((correctCount / items.length) * 100);
  const criticalErrors = resultItems.filter((r) => r.critical).length;
  const passed = scorePercent >= step.passPercent && criticalErrors === 0;

  const result: AssessmentResult = {
    attempt: state.assessment.attempt,
    scorePercent,
    correctCount,
    total: items.length,
    criticalErrors,
    passed,
    items: resultItems,
    missedConcepts: [...missed],
    submittedAt: now,
  };
  state.assessment.result = result;
  state.assessment.history.push({ attempt: result.attempt, scorePercent, passed, submittedAt: now });
  state.assessment.remediationReviewed = false;

  const changes: CompetencyChange[] = [];
  if (passed) {
    state.status = "PASSED";
    if (!state.completedSteps.includes(step.id)) state.completedSteps.push(step.id);
    allCompetencies(mod).forEach((key) =>
      changes.push({ key, level: "MASTERY_DEMONSTRATED", reason: `Passed verification (attempt ${result.attempt}, ${scorePercent}%).` }),
    );
  } else {
    state.status = "REMEDIATION";
    const reason = `Verification attempt ${result.attempt} not passed (${scorePercent}%, ${criticalErrors} critical).`;
    (missedCompetencies.size ? [...missedCompetencies] : allCompetencies(mod)).forEach((key) =>
      changes.push({ key, level: "REMEDIATION", reason }),
    );
  }
  return { state, result, attempts, changes };
}

export function acknowledgeRemediation(mod: LessonModule, input: LessonState): LessonState {
  const state = clone(input);
  if (state.status !== "REMEDIATION") throw new LessonError("NOT_ALLOWED", "No remediation is pending.");
  state.assessment.remediationReviewed = true;
  return state;
}

export function startRetake(mod: LessonModule, input: LessonState): LessonState {
  const state = clone(input);
  const step = currentStep(mod, state);
  if (step.kind !== "assessment" || state.status !== "REMEDIATION") throw new LessonError("NOT_ALLOWED", "A retake is not available.");
  if (!state.assessment.remediationReviewed) throw new LessonError("NOT_ALLOWED", "Review the remediation material first.");
  const attempt = state.assessment.attempt + 1;
  state.assessment = {
    ...state.assessment,
    attempt,
    itemIds: assessmentItemsFor(step, attempt).map((i) => i.id),
    draft: {},
    evidence: {},
    result: undefined,
    remediationReviewed: false,
  };
  state.status = "IN_PROGRESS";
  return state;
}

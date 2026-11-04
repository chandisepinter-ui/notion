/**
 * Sanitized course view for the browser: answer keys, explanations and
 * critical flags are removed until an answer has been graded.
 */
import { STAGES, type Stage } from "@/lib/academy/types";
import { canAdvanceCourse, currentCourseStep, displayOrder } from "./engine";
import type { CourseModule, CourseState, LearnCard, MasteryResult, Question, QuestionFeedback, SourceRecord } from "./types";

export type ClientQuestion = {
  id: string;
  type: Question["type"];
  prompt: string;
  /** Options in display order; `index` is the original index the server grades against. */
  options: { index: number; text: string }[];
  scored: boolean;
  conflictId: string | null;
};

export type CourseStepView =
  | { kind: "prime"; id: string; stage: Stage; title: string; body: string }
  | { kind: "cards"; id: string; stage: Stage; title: string; card: LearnCard & { sourceTitle: string | null }; index: number; total: number }
  | { kind: "media"; id: string; stage: Stage; title: string; body: string; files: { name: string; approved: boolean }[] }
  | { kind: "info" | "supervisor-gate"; id: string; stage: Stage; title: string; cards: { title: string; body: string }[] }
  | { kind: "simulation"; id: string; stage: Stage; title: string; scenarioId: string; scenarioTitle: string; brief: string }
  | { kind: "pending-source"; id: string; stage: Stage; title: string; body: string; acknowledged: boolean }
  | {
      kind: "practice";
      id: string;
      stage: Stage;
      title: string;
      question: ClientQuestion;
      position: number;
      total: number;
      tries: number;
      solved: boolean;
      last: number[] | null;
      feedback: QuestionFeedback | null;
    }
  | {
      kind: "mastery";
      id: string;
      stage: Stage;
      title: string;
      passPercent: number;
      attempt: number;
      questions: ClientQuestion[];
      draft: Record<string, number[]>;
      result: MasteryResult | null;
      remediationReviewed: boolean;
      simulationChecks: string[];
    };

export type CourseView = {
  format: "course";
  moduleKey: string;
  dayNumber: number;
  dayTitle: string;
  title: string;
  competencyTarget: string;
  contentStatus: string;
  status: CourseState["status"];
  stepIndex: number;
  totalSteps: number;
  stages: { key: Stage; label: string; description: string; state: "done" | "current" | "upcoming" }[];
  step: CourseStepView;
  canAdvance: boolean;
  canGoBack: boolean;
};

function clientQuestion(q: Question, attempt: number): ClientQuestion {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: displayOrder(q, attempt).map((i) => ({ index: i, text: q.options[i] })),
    scored: q.graded,
    conflictId: q.conflictId,
  };
}

export function buildCourseView(
  mod: CourseModule,
  s: CourseState,
  ctx: { sources: SourceRecord[]; approvedMedia: Set<string> },
): CourseView {
  const step = currentCourseStep(mod, s);
  const presentStages = STAGES.filter((st) => mod.steps.some((x) => x.stage === st.key));
  const idx = presentStages.findIndex((x) => x.key === step.stage);
  const stages = presentStages.map((x, i) => ({
    ...x,
    state: s.status === "PASSED" || i < idx ? ("done" as const) : i === idx ? ("current" as const) : ("upcoming" as const),
  }));

  let v: CourseStepView;
  switch (step.kind) {
    case "prime":
      v = { kind: "prime", id: step.id, stage: step.stage, title: step.title, body: step.body };
      break;
    case "cards": {
      const i = Math.min(s.cardIndex[step.id] ?? 0, step.cards.length - 1);
      const card = step.cards[i];
      v = {
        kind: "cards",
        id: step.id,
        stage: step.stage,
        title: step.title,
        card: { ...card, sourceTitle: ctx.sources.find((x) => x.id === card.sourceId)?.title ?? null },
        index: i,
        total: step.cards.length,
      };
      break;
    }
    case "media":
      v = { kind: "media", id: step.id, stage: step.stage, title: step.title, body: step.body, files: step.files.map((f) => ({ name: f, approved: ctx.approvedMedia.has(f) })) };
      break;
    case "info":
    case "supervisor-gate":
      v = { kind: step.kind, id: step.id, stage: step.stage, title: step.title, cards: step.cards };
      break;
    case "simulation":
      v = { kind: "simulation", id: step.id, stage: step.stage, title: step.title, scenarioId: step.scenarioId, scenarioTitle: step.scenarioTitle, brief: step.brief };
      break;
    case "pending-source":
      v = { kind: "pending-source", id: step.id, stage: step.stage, title: step.title, body: step.body, acknowledged: s.status === "PENDING_SOURCE" };
      break;
    case "practice": {
      const p = s.practice[step.id] ?? { position: 0, items: {} };
      const q = step.items[p.position];
      const st = p.items[q.id];
      v = {
        kind: "practice",
        id: step.id,
        stage: step.stage,
        title: step.title,
        question: clientQuestion(q, 1),
        position: p.position,
        total: step.items.length,
        tries: st?.tries ?? 0,
        solved: st?.solved ?? false,
        last: st?.last ?? null,
        feedback: st?.feedback ?? null,
      };
      break;
    }
    case "mastery":
      v = {
        kind: "mastery",
        id: step.id,
        stage: step.stage,
        title: step.title,
        passPercent: step.passPercent,
        attempt: s.mastery.attempt,
        questions: step.items.map((q) => clientQuestion(q, s.mastery.attempt)),
        draft: s.mastery.draft,
        result: s.mastery.result ?? null,
        remediationReviewed: s.mastery.remediationReviewed,
        simulationChecks: step.simulationChecks,
      };
      break;
  }

  return {
    format: "course",
    moduleKey: mod.key,
    dayNumber: mod.dayNumber,
    dayTitle: mod.dayTitle,
    title: mod.title,
    competencyTarget: mod.competencyTarget,
    contentStatus: mod.contentStatus,
    status: s.status,
    stepIndex: s.stepIndex,
    totalSteps: mod.steps.length,
    stages,
    step: v,
    canAdvance: canAdvanceCourse(mod, s),
    canGoBack: step.kind !== "mastery" && (s.stepIndex > 0 || (step.kind === "cards" && (s.cardIndex[step.id] ?? 0) > 0)),
  };
}

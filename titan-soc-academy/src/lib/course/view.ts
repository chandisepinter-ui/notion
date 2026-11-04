/**
 * Sanitized course view for the browser: answer keys, explanations and
 * critical flags are removed until an answer has been graded.
 */
import { STAGES, type Stage } from "@/lib/academy/types";
import { canAdvanceCourse, currentCourseStep, displayOrder } from "./engine";
import type { Walkthrough } from "./walkthrough-model";
import type { CourseModule, CourseState, LearnCard, MasteryResult, Question, QuestionFeedback, Ruling, SourceRecord } from "./types";

export type ClientQuestion = {
  id: string;
  type: Question["type"];
  prompt: string;
  /** Options in display order; `index` is the original index the server grades against. */
  options: { index: number; text: string }[];
  scored: boolean;
  conflictId: string | null;
  /** Owner ruling on the linked conflict, if one has been recorded. */
  ruling: Ruling | null;
};

/** A guided click-through (ungraded GUIDE practice), with frame URLs. */
export type ClientWalkthrough = Omit<Walkthrough, "screens"> & { done: boolean; misses: number | null; screens: (Walkthrough["screens"][number] & { src: string })[] };

export type CourseStepView =
  | { kind: "prime"; id: string; stage: Stage; title: string; body: string }
  | { kind: "cards"; id: string; stage: Stage; title: string; card: LearnCard & { sourceTitle: string | null; rulings: Ruling[] }; index: number; total: number }
  | { kind: "media"; id: string; stage: Stage; title: string; body: string; files: { name: string; approved: boolean; src: string | null }[]; walkthroughs: ClientWalkthrough[] }
  | { kind: "info" | "supervisor-gate"; id: string; stage: Stage; title: string; cards: { title: string; body: string }[] }
  | { kind: "simulation"; id: string; stage: Stage; title: string; scenarioId: string; scenarioTitle: string; brief: string; playable: boolean; done: boolean; lastScore: number | null; lastPassed: boolean | null }
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
      /** Simulator scenarios that count toward this mastery check. */
      simRequired: { id: string; label: string; passed: boolean; lastScore: number | null }[];
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

type Ctx = { sources: SourceRecord[]; approvedMedia: Set<string>; rulings?: Map<string, Ruling>; playableSims?: Set<string>; walkthroughs?: Walkthrough[]; installedVideos?: Set<string> };

/** Walkthroughs are offered on the module's last media step ("Watch again — now spot each step"). */
export function walkthroughStepId(mod: CourseModule): string | null {
  const media = mod.steps.filter((x) => x.kind === "media");
  return media.length ? media[media.length - 1].id : null;
}

function clientQuestion(q: Question, attempt: number, ctx: Ctx): ClientQuestion {
  return {
    ruling: (q.conflictId && ctx.rulings?.get(q.conflictId)) || null,
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
  ctx: Ctx,
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
        card: {
          ...card,
          sourceTitle: ctx.sources.find((x) => x.id === card.sourceId)?.title ?? null,
          rulings: (card.conflictIds ?? []).map((c) => ctx.rulings?.get(c)).filter((r): r is Ruling => !!r),
        },
        index: i,
        total: step.cards.length,
      };
      break;
    }
    case "media":
      v = {
        kind: "media", id: step.id, stage: step.stage, title: step.title, body: step.body,
        files: step.files.map((f) => {
          const installed = !!ctx.installedVideos?.has(f);
          return { name: f, approved: installed || ctx.approvedMedia.has(f), src: installed ? `/api/media/video/${encodeURIComponent(f)}` : null };
        }),
        walkthroughs: step.id === walkthroughStepId(mod)
          ? (ctx.walkthroughs ?? []).map((w) => ({
              ...w,
              done: !!s.walkthroughs?.[w.id]?.done,
              misses: s.walkthroughs?.[w.id]?.misses ?? null,
              screens: w.screens.map((x) => ({ ...x, src: `/api/media/walkthrough/${encodeURIComponent(x.file)}` })),
            }))
          : [],
      };
      break;
    case "info":
    case "supervisor-gate":
      v = { kind: step.kind, id: step.id, stage: step.stage, title: step.title, cards: step.cards };
      break;
    case "simulation":
      v = {
        kind: "simulation", id: step.id, stage: step.stage, title: step.title, scenarioId: step.scenarioId, scenarioTitle: step.scenarioTitle, brief: step.brief,
        playable: !!ctx.playableSims?.has(step.scenarioId),
        done: !!s.sims?.[step.scenarioId]?.guidedDone,
        lastScore: s.sims?.[step.scenarioId]?.lastScore ?? null,
        lastPassed: s.sims?.[step.scenarioId]?.lastPassed ?? null,
      };
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
        question: clientQuestion(q, 1, ctx),
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
        questions: step.items.map((q) => clientQuestion(q, s.mastery.attempt, ctx)),
        draft: s.mastery.draft,
        result: s.mastery.result ?? null,
        remediationReviewed: s.mastery.remediationReviewed,
        simulationChecks: step.simulationChecks,
        simRequired: (step.simulationScenarioIds ?? [])
          .map((id, i) => ({ id, label: step.simulationChecks[i] ?? id }))
          .filter((x) => ctx.playableSims?.has(x.id))
          .map((x) => ({ ...x, passed: !!s.sims?.[x.id]?.masteryPassed, lastScore: s.sims?.[x.id]?.lastScore ?? null })),
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
    canAdvance: canAdvanceCourse(mod, s, { playable: ctx.playableSims ?? new Set() }),
    canGoBack: step.kind !== "mastery" && (s.stepIndex > 0 || (step.kind === "cards" && (s.cardIndex[step.id] ?? 0) > 0)),
  };
}

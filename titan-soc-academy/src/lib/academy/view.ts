/**
 * Builds the SANITIZED lesson view sent to the browser.
 * Answer keys, explanations and critical flags are stripped. Feedback appears
 * only for attempts that have already been graded.
 */
import { STAGES, type AssessmentResult, type Choice, type ContentBlock, type DecisionItem, type EvidenceKey, type Feedback, type ItemResponse, type LessonModule, type LessonState, type Scenario, type SiteProfile, type Stage, type WalkthroughPanel } from "./types";
import { activeItem, assessmentItemsFor, canAdvance, currentStep, itemKey, practiceProgress } from "./engine";

export type ClientItem = {
  id: string;
  scenarioId: string;
  prompt: string;
  requiredEvidence: EvidenceKey[];
  hints: string[];
  hintsAvailable: number;
};

export type ClientItemState = {
  tries: number;
  solved: boolean;
  evidence: EvidenceKey[];
  lastResponse?: ItemResponse;
  lastFeedback?: Feedback;
};

export type StepView =
  | { kind: "briefing"; id: string; stage: Stage; title: string; task: string; objectives: string[]; body: ContentBlock[] }
  | { kind: "walkthrough"; id: string; stage: Stage; title: string; task: string; scenarioId: string; panels: WalkthroughPanel[]; panelIndex: number; demonstratedAnswer: ItemResponse }
  | { kind: "decision"; id: string; stage: Stage; title: string; task: string; item: ClientItem; itemState: ClientItemState }
  | {
      kind: "practice";
      id: string;
      stage: Stage;
      title: string;
      task: string;
      item: ClientItem;
      itemState: ClientItemState;
      position: number;
      total: number;
      firstTryCorrect: number;
      required: number;
    }
  | {
      kind: "assessment";
      id: string;
      stage: Stage;
      title: string;
      task: string;
      intro: string;
      passPercent: number;
      attempt: number;
      items: ClientItem[];
      draft: Record<string, ItemResponse>;
      evidence: Record<string, EvidenceKey[]>;
      result: AssessmentResult | null;
      remediationReviewed: boolean;
      history: LessonState["assessment"]["history"];
      remediation: { label: string; explanations: string[] }[];
    };

export type LessonView = {
  moduleKey: string;
  dayNumber: number;
  title: string;
  subtitle: string;
  fictionalNotice: string;
  status: LessonState["status"];
  stepIndex: number;
  totalSteps: number;
  stages: { key: Stage; label: string; description: string; state: "done" | "current" | "upcoming" }[];
  step: StepView;
  canAdvance: boolean;
  actions: Choice[];
  sites: SiteProfile[];
  scenarios: Scenario[];
};

function toClientItem(item: DecisionItem, hintsShown: number): ClientItem {
  const hints = item.hints ?? [];
  return {
    id: item.id,
    scenarioId: item.scenarioId,
    prompt: item.prompt,
    requiredEvidence: item.requiredEvidence,
    hints: hints.slice(0, hintsShown),
    hintsAvailable: hints.length,
  };
}

export function buildLessonView(mod: LessonModule, state: LessonState): LessonView {
  const step = currentStep(mod, state);
  const currentStage = step.stage;
  const stageIndex = STAGES.findIndex((s) => s.key === currentStage);
  const stages = STAGES.map((s, i) => ({
    ...s,
    state:
      state.status === "PASSED" || i < stageIndex ? ("done" as const) : i === stageIndex ? ("current" as const) : ("upcoming" as const),
  }));

  let stepView: StepView;
  const scenarioIds = new Set<string>();

  switch (step.kind) {
    case "briefing":
      stepView = { kind: "briefing", id: step.id, stage: step.stage, title: step.title, task: step.task, objectives: step.objectives, body: step.body };
      break;
    case "walkthrough":
      scenarioIds.add(step.scenarioId);
      stepView = {
        kind: "walkthrough",
        id: step.id,
        stage: step.stage,
        title: step.title,
        task: step.task,
        scenarioId: step.scenarioId,
        panels: step.panels,
        panelIndex: state.walkthrough[step.id] ?? 0,
        demonstratedAnswer: step.demonstratedAnswer,
      };
      break;
    case "decision":
    case "practice": {
      const { item } = activeItem(mod, state)!;
      scenarioIds.add(item.scenarioId);
      const is = state.items[itemKey(step.id, item.id)];
      const itemState: ClientItemState = {
        tries: is?.tries ?? 0,
        solved: is?.solved ?? false,
        evidence: is?.evidence ?? [],
        lastResponse: is?.lastResponse,
        lastFeedback: is?.lastFeedback,
      };
      const clientItem = toClientItem(item, is?.hintsShown ?? 0);
      if (step.kind === "decision") {
        stepView = { kind: "decision", id: step.id, stage: step.stage, title: step.title, task: step.task, item: clientItem, itemState };
      } else {
        const p = practiceProgress(state, step);
        stepView = {
          kind: "practice",
          id: step.id,
          stage: step.stage,
          title: step.title,
          task: step.task,
          item: clientItem,
          itemState,
          position: p.position,
          total: step.items.length,
          firstTryCorrect: p.firstTryCorrect,
          required: step.requiredFirstTryCorrect,
        };
      }
      break;
    }
    case "assessment": {
      const items = assessmentItemsFor(step, state.assessment.attempt || 1);
      items.forEach((i) => scenarioIds.add(i.scenarioId));
      const result = state.assessment.result ?? null;
      const remediation = result && !result.passed
        ? result.missedConcepts
            .map((k) => mod.misconceptions.find((m) => m.key === k))
            .filter((m): m is NonNullable<typeof m> => !!m)
            .map((m) => ({ label: m.label, explanations: m.explanations }))
        : [];
      stepView = {
        kind: "assessment",
        id: step.id,
        stage: step.stage,
        title: step.title,
        task: step.task,
        intro: step.intro,
        passPercent: step.passPercent,
        attempt: state.assessment.attempt || 1,
        items: items.map((i) => toClientItem(i, 0)),
        draft: state.assessment.draft,
        evidence: state.assessment.evidence,
        result,
        remediationReviewed: state.assessment.remediationReviewed,
        history: state.assessment.history,
        remediation,
      };
      break;
    }
  }

  const scenarios = mod.scenarios.filter((s) => scenarioIds.has(s.id));
  const siteIds = new Set(scenarios.map((s) => s.siteId));

  return {
    moduleKey: mod.key,
    dayNumber: mod.dayNumber,
    title: mod.title,
    subtitle: mod.subtitle,
    fictionalNotice: mod.fictionalNotice,
    status: state.status,
    stepIndex: state.stepIndex,
    totalSteps: mod.steps.length,
    stages,
    step: stepView,
    canAdvance: canAdvance(mod, state),
    actions: mod.actions,
    sites: mod.sites.filter((s) => siteIds.has(s.id)),
    scenarios,
  };
}

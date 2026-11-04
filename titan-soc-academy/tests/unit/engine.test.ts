import { describe, expect, it } from "vitest";
import {
  acknowledgeRemediation,
  advance,
  answerItem,
  assessmentItemsFor,
  canAdvance,
  currentStep,
  initialState,
  LessonError,
  parseState,
  recordEvidence,
  revealHint,
  saveDraft,
  startRetake,
  submitAssessment,
} from "@/lib/academy/engine";
import { buildLessonView } from "@/lib/academy/view";
import { immixAlertInvestigation as mod } from "@/content/modules/immix-alert-investigation";
import type { AssessmentStep, DecisionItem, LessonState, PracticeStep } from "@/lib/academy/types";

const EVIDENCE = ["clip", "schedule", "plan"] as const;

function openEvidence(state: LessonState, stepId: string, itemId: string) {
  let s = state;
  for (const k of EVIDENCE) s = recordEvidence(mod, s, stepId, itemId, k);
  return s;
}

function toStep(kind: string) {
  let s = initialState();
  while (currentStep(mod, s).kind !== kind) {
    const step = currentStep(mod, s);
    if (step.kind === "decision") {
      s = openEvidence(s, step.id, step.item.id);
      s = answerItem(mod, s, step.id, step.item.id, { action: step.item.correctAction, rule: step.item.correctRule }).state;
    }
    if (step.kind === "practice") {
      const item = step.items[s.practice[step.id]?.position ?? 0];
      s = openEvidence(s, step.id, item.id);
      s = answerItem(mod, s, step.id, item.id, { action: item.correctAction, rule: item.correctRule }).state;
    }
    s = advance(mod, s).state;
  }
  return s;
}

describe("content integrity", () => {
  it("every item references a real scenario, site, action and rule", () => {
    const all: DecisionItem[] = [];
    for (const step of mod.steps) {
      if (step.kind === "decision") all.push(step.item);
      if (step.kind === "practice") all.push(...step.items);
      if (step.kind === "assessment") step.groups.forEach((g) => all.push(...g));
      if (step.kind === "walkthrough") expect(mod.scenarios.some((s) => s.id === step.scenarioId)).toBe(true);
    }
    for (const it of all) {
      const sc = mod.scenarios.find((s) => s.id === it.scenarioId);
      expect(sc, it.id).toBeTruthy();
      const site = mod.sites.find((s) => s.id === sc!.siteId);
      expect(site, it.id).toBeTruthy();
      expect(site!.cameras.some((c) => c.id === sc!.cameraId), it.id).toBe(true);
      expect(mod.actions.some((a) => a.id === it.correctAction), it.id).toBe(true);
      expect(site!.responsePlan.some((r) => r.id === it.correctRule), it.id).toBe(true);
      it.competencies.forEach((c) => expect(mod.competencies.some((x) => x.key === c)).toBe(true));
    }
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
  });
});

describe("progression", () => {
  it("starts at the briefing and follows INTRODUCE→DEMONSTRATE→GUIDE→PRACTICE→CHALLENGE→VERIFY", () => {
    expect(mod.steps.map((s) => s.stage)).toEqual(["introduce", "demonstrate", "guide", "practice", "challenge", "verify"]);
    const r = advance(mod, initialState());
    expect(r.changes.every((c) => c.level === "LEARNING")).toBe(true);
    expect(currentStep(mod, r.state).kind).toBe("walkthrough");
  });

  it("walkthrough requires stepping through every panel", () => {
    let s = toStep("walkthrough");
    const step = currentStep(mod, s);
    if (step.kind !== "walkthrough") throw new Error();
    for (let i = 0; i < step.panels.length - 1; i++) {
      s = advance(mod, s).state;
      expect(currentStep(mod, s).kind).toBe("walkthrough");
    }
    s = advance(mod, s).state;
    expect(currentStep(mod, s).kind).toBe("decision");
  });

  it("cannot continue a decision step until it is solved", () => {
    const s = toStep("decision");
    expect(canAdvance(mod, s)).toBe(false);
    expect(() => advance(mod, s)).toThrow(LessonError);
  });
});

describe("evidence gating", () => {
  it("rejects an answer before the required evidence is reviewed", () => {
    const s = toStep("decision");
    const step = currentStep(mod, s);
    if (step.kind !== "decision") throw new Error();
    const partial = recordEvidence(mod, s, step.id, step.item.id, "clip");
    try {
      answerItem(mod, partial, step.id, step.item.id, { action: "false-alarm", rule: "R1" });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as LessonError).code).toBe("EVIDENCE_REQUIRED");
    }
  });
});

describe("feedback", () => {
  it("explains the concept on a wrong answer without revealing the correct choice, and allows retry", () => {
    let s = toStep("decision");
    const step = currentStep(mod, s);
    if (step.kind !== "decision") throw new Error();
    s = openEvidence(s, step.id, step.item.id);
    const wrong = answerItem(mod, s, step.id, step.item.id, { action: "escalate", rule: "R3" });
    expect(wrong.feedback.correct).toBe(false);
    expect(wrong.feedback.explanation).toBeUndefined();
    expect(wrong.feedback.misconception).toMatch(/Escalating/);
    expect(wrong.attempt.isCorrect).toBe(false);
    const right = answerItem(mod, wrong.state, step.id, step.item.id, { action: "false-alarm", rule: "R1" });
    expect(right.feedback.correct).toBe(true);
    expect(right.feedback.explanation).toContain("deer");
    expect(right.attempt.tryNumber).toBe(2);
    expect(right.changes.some((c) => c.level === "ASSISTED")).toBe(true);
  });

  it("gives an alternate explanation when the same mistake repeats", () => {
    let s = toStep("decision");
    const step = currentStep(mod, s);
    if (step.kind !== "decision") throw new Error();
    s = openEvidence(s, step.id, step.item.id);
    const a = answerItem(mod, s, step.id, step.item.id, { action: "escalate", rule: "R3" });
    expect(a.feedback.alternate).toBeUndefined();
    const b = answerItem(mod, a.state, step.id, step.item.id, { action: "escalate", rule: "R1" });
    expect(b.feedback.alternate?.text).toBeTruthy();
    expect(b.feedback.alternate?.text).not.toEqual(b.feedback.message);
  });

  it("flags right action with wrong rule", () => {
    let s = toStep("decision");
    const step = currentStep(mod, s);
    if (step.kind !== "decision") throw new Error();
    s = openEvidence(s, step.id, step.item.id);
    const r = answerItem(mod, s, step.id, step.item.id, { action: "false-alarm", rule: "R4" });
    expect(r.feedback.headline).toBe("Right action, wrong reason");
    expect(r.feedback.actionCorrect).toBe(true);
    expect(r.feedback.ruleCorrect).toBe(false);
  });
});

describe("practice mastery shortcut", () => {
  it("lets a learner skip remaining practice after two first-try correct answers", () => {
    let s = toStep("practice");
    const step = currentStep(mod, s) as PracticeStep;
    for (let i = 0; i < 2; i++) {
      const item = step.items[i];
      s = openEvidence(s, step.id, item.id);
      s = answerItem(mod, s, step.id, item.id, { action: item.correctAction, rule: item.correctRule }).state;
      const r = advance(mod, s);
      s = r.state;
      if (i === 1) expect(r.changes.every((c) => c.level === "PRACTICING")).toBe(true);
    }
    expect(currentStep(mod, s).stage).toBe("challenge");
  });

  it("requires all practice items and flags reinforcement when first-try target is missed", () => {
    let s = toStep("practice");
    const step = currentStep(mod, s) as PracticeStep;
    let last;
    for (const item of step.items) {
      s = openEvidence(s, step.id, item.id);
      const wrongAction = mod.actions.find((a) => a.id !== item.correctAction)!.id;
      s = answerItem(mod, s, step.id, item.id, { action: wrongAction, rule: item.correctRule }).state;
      s = answerItem(mod, s, step.id, item.id, { action: item.correctAction, rule: item.correctRule }).state;
      last = advance(mod, s);
      s = last.state;
    }
    expect(s.practice[step.id].reinforcement).toBe(true);
    expect(last!.changes.every((c) => c.level === "ASSISTED")).toBe(true);
    expect(currentStep(mod, s).stage).toBe("challenge");
  });
});

describe("challenge", () => {
  it("treats a vest-wearer outside the schedule as appearance-over-schedule and critical", () => {
    let s = toStep("decision");
    s = toStepFrom(s, "challenge");
    const step = currentStep(mod, s);
    if (step.kind !== "decision") throw new Error();
    s = openEvidence(s, step.id, step.item.id);
    const r = answerItem(mod, s, step.id, step.item.id, { action: "authorized", rule: "R2" });
    expect(r.feedback.critical).toBe(true);
    expect(r.feedback.misconception).toMatch(/appearance/i);
    expect(r.attempt.isCritical).toBe(true);
  });
});

function toStepFrom(start: LessonState, stage: string) {
  let s = start;
  while (currentStep(mod, s).stage !== stage) {
    const step = currentStep(mod, s);
    if (step.kind === "decision") {
      s = openEvidence(s, step.id, step.item.id);
      s = answerItem(mod, s, step.id, step.item.id, { action: step.item.correctAction, rule: step.item.correctRule }).state;
    }
    if (step.kind === "practice") {
      const item = step.items[s.practice[step.id]?.position ?? 0];
      s = openEvidence(s, step.id, item.id);
      s = answerItem(mod, s, step.id, item.id, { action: item.correctAction, rule: item.correctRule }).state;
    }
    s = advance(mod, s).state;
  }
  return s;
}

describe("verification", () => {
  function fill(s: LessonState, correct: (i: number) => boolean) {
    const step = currentStep(mod, s) as AssessmentStep;
    assessmentItemsFor(step, s.assessment.attempt).forEach((it, i) => {
      for (const k of EVIDENCE) s = recordEvidence(mod, s, step.id, it.id, k);
      const action = correct(i) ? it.correctAction : it.correctAction === "monitor" ? "false-alarm" : "monitor";
      s = saveDraft(mod, s, it.id, { action, rule: it.correctRule });
    });
    return s;
  }

  it("never exposes answer keys in the client view before submission", () => {
    const s = toStep("assessment");
    const view = buildLessonView(mod, s);
    const json = JSON.stringify(view);
    expect(json).not.toContain("correctAction");
    expect(json).not.toContain("correctRule");
    expect(json).not.toContain("explanation");
    expect(view.step.kind).toBe("assessment");
  });

  it("refuses incomplete submissions", () => {
    const s = toStep("assessment");
    expect(() => submitAssessment(mod, s)).toThrow(LessonError);
  });

  it("refuses an answer before evidence is reviewed", () => {
    const s = toStep("assessment");
    const id = s.assessment.itemIds[0];
    expect(() => saveDraft(mod, s, id, { action: "monitor" })).toThrow(/evidence/i);
  });

  it("passes at 100% and records mastery", () => {
    const s = fill(toStep("assessment"), () => true);
    const r = submitAssessment(mod, s);
    expect(r.result.passed).toBe(true);
    expect(r.state.status).toBe("PASSED");
    expect(r.attempts).toHaveLength(5);
    expect(r.changes.every((c) => c.level === "MASTERY_DEMONSTRATED")).toBe(true);
  });

  it("fails on a critical error even at 80%, then requires remediation review before a retake with new variants", () => {
    let s = toStep("assessment");
    const step = currentStep(mod, s) as AssessmentStep;
    const items = assessmentItemsFor(step, 1);
    const escalateIdx = items.findIndex((i) => i.correctAction === "escalate");
    s = fill(s, (i) => i !== escalateIdx);
    const r = submitAssessment(mod, s);
    expect(r.result.scorePercent).toBe(80);
    expect(r.result.criticalErrors).toBe(1);
    expect(r.result.passed).toBe(false);
    expect(r.state.status).toBe("REMEDIATION");
    expect(r.changes.some((c) => c.level === "REMEDIATION")).toBe(true);
    expect(() => startRetake(mod, r.state)).toThrow(/remediation/i);
    const reviewed = acknowledgeRemediation(mod, r.state);
    const retake = startRetake(mod, reviewed);
    expect(retake.assessment.attempt).toBe(2);
    expect(retake.assessment.itemIds).not.toEqual(r.state.assessment.itemIds);
    expect(retake.assessment.draft).toEqual({});
  });
});

describe("guide hints", () => {
  it("reveals hints one at a time and only the revealed ones reach the client", () => {
    let s = toStep("decision");
    const step = currentStep(mod, s);
    if (step.kind !== "decision") throw new Error();
    expect(buildLessonView(mod, s).step).toMatchObject({ item: { hints: [], hintsAvailable: 3 } });
    s = revealHint(mod, s, step.id);
    const v = buildLessonView(mod, s).step;
    if (v.kind !== "decision") throw new Error();
    expect(v.item.hints).toHaveLength(1);
  });
});

describe("state parsing", () => {
  it("recovers from damaged JSON", () => {
    expect(parseState("{not json").stepIndex).toBe(0);
    expect(parseState(JSON.stringify({ stepIndex: 3 })).stepIndex).toBe(3);
  });
});

/**
 * Course engine tests using a small FICTIONAL fixture (no Titan content).
 */
import { describe, expect, it } from "vitest";
import {
  acknowledgeCourseRemediation, advanceCourse, answerPractice, backCourse, currentCourseStep, displayOrder,
  initialCourseState, isCorrect, LessonError, saveMasteryAnswer, startRetest, submitMastery, validResponse,
} from "@/lib/course/engine";
import { buildCourseView } from "@/lib/course/view";
import type { CourseModule, Question } from "@/lib/course/types";

const q = (id: string, type: Question["type"], answer: number[], extra: Partial<Question> = {}): Question => ({
  id, type, prompt: `Prompt ${id}`, options: ["Alpha", "Bravo", "Charlie", "Delta"], answer,
  explanation: `Because ${id}.`, critical: false, graded: true, weight: 1, sourceId: "SRC", conflictId: null, verification: "SOURCE_GROUNDED", ...extra,
});

const mod: CourseModule = {
  format: "course", key: "TST01", version: "t", dayNumber: 1, sortOrder: 1, dayTitle: "Test Day", title: "Fixture",
  competencyTarget: "Do the thing", domain: "test", contentStatus: "SOURCE_GROUNDED_PENDING_APPROVAL",
  steps: [
    { id: "p", stage: "introduce", kind: "prime", title: "Prime", body: "Hook" },
    { id: "c", stage: "demonstrate", kind: "cards", title: "Learn", cards: [
      { id: "c1", title: "One", body: "Rule one\nWhy it matters: reason", sourceId: "SRC", notVerified: false },
      { id: "c2", title: "Two", body: "Rule two", sourceId: null, notVerified: true },
    ] },
    { id: "g", stage: "guide", kind: "practice", title: "Guided", items: [q("P1", "mcq", [2], { graded: false }), q("P2", "order", [3, 1, 0, 2], { graded: false })] },
    { id: "m", stage: "verify", kind: "mastery", title: "Mastery", passPercent: 90, simulationChecks: [], items: [
      q("M1", "mcq", [1]), q("M2", "multi", [0, 3]), q("M3", "order", [2, 0, 3, 1]), q("M4", "mcq", [0], { critical: true }),
      q("M5", "mcq", [3], { graded: false, conflictId: "CX" }),
    ] },
  ],
};
const ctx = { sources: [{ id: "SRC", title: "Source Doc", path: "", date: "", status: "", note: "" }], approvedMedia: new Set<string>() };

function toMastery() {
  let s = initialCourseState();
  s = advanceCourse(mod, s).state; // prime
  s = advanceCourse(mod, s).state; // card 1 -> 2
  const learn = advanceCourse(mod, s);
  expect(learn.changes[0]?.level).toBe("LEARNING");
  s = learn.state;
  s = answerPractice(mod, s, "g", "P1", [2]).state;
  s = advanceCourse(mod, s).state;
  s = answerPractice(mod, s, "g", "P2", [3, 1, 0, 2]).state;
  const prac = advanceCourse(mod, s);
  expect(prac.changes[0]?.level).toBe("ASSISTED");
  return prac.state;
}

describe("grading", () => {
  it("mcq, multi (any order) and order (exact sequence)", () => {
    expect(isCorrect(q("a", "mcq", [1]), [1])).toBe(true);
    expect(isCorrect(q("a", "multi", [0, 3]), [3, 0])).toBe(true);
    expect(isCorrect(q("a", "multi", [0, 3]), [0])).toBe(false);
    expect(isCorrect(q("a", "order", [2, 0, 3, 1]), [2, 0, 3, 1])).toBe(true);
    expect(isCorrect(q("a", "order", [2, 0, 3, 1]), [0, 2, 3, 1])).toBe(false);
  });
  it("rejects malformed responses", () => {
    expect(validResponse(q("a", "mcq", [1]), [1, 2])).toBe(false);
    expect(validResponse(q("a", "order", [0, 1, 2, 3]), [0, 1])).toBe(false);
    expect(validResponse(q("a", "multi", [0]), [9])).toBe(false);
    expect(validResponse(q("a", "multi", [0]), [1, 1])).toBe(false);
  });
  it("reshuffles options on retests but keeps the authored order on attempt 1", () => {
    const x = q("SH", "mcq", [0]);
    expect(displayOrder(x, 1)).toEqual([0, 1, 2, 3]);
    expect([...displayOrder(x, 2)].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("navigation", () => {
  it("cards step through one at a time and Back works", () => {
    let s = advanceCourse(mod, initialCourseState()).state;
    s = advanceCourse(mod, s).state;
    expect(s.cardIndex.c).toBe(1);
    s = backCourse(mod, s);
    expect(s.cardIndex.c).toBe(0);
  });
  it("practice must be answered before continuing; explanation is shown, answer revealed only after two misses", () => {
    let s = advanceCourse(mod, advanceCourse(mod, advanceCourse(mod, initialCourseState()).state).state).state;
    expect(currentCourseStep(mod, s).kind).toBe("practice");
    expect(() => advanceCourse(mod, s)).toThrow(LessonError);
    const r1 = answerPractice(mod, s, "g", "P1", [0]);
    expect(r1.feedback.correct).toBe(false);
    expect(r1.feedback.correctAnswer).toEqual([]);
    expect(r1.feedback.explanation).toContain("Because");
    const r2 = answerPractice(mod, r1.state, "g", "P1", [1]);
    expect(r2.feedback.correctAnswer).toEqual(["Charlie"]);
    s = answerPractice(mod, r2.state, "g", "P1", [0]).state; // third miss: moves on
    expect(advanceCourse(mod, s).state.practice.g.position).toBe(1);
  });
});

describe("mastery", () => {
  const answerAll = (s: ReturnType<typeof initialCourseState>, over: Record<string, number[]> = {}) => {
    const base: Record<string, number[]> = { M1: [1], M2: [3, 0], M3: [2, 0, 3, 1], M4: [0], M5: [1], ...over };
    for (const [id, v] of Object.entries(base)) s = saveMasteryAnswer(mod, s, id, v);
    return s;
  };
  it("never sends answer keys to the browser before grading", () => {
    const json = JSON.stringify(buildCourseView(mod, toMastery(), ctx));
    expect(json).not.toContain('"answer"');
    expect(json).not.toContain("Because M1");
  });
  it("passes at 100% of scored items; unscored conflict items do not count", () => {
    const r = submitMastery(mod, answerAll(toMastery()));
    expect(r.result.gradedCount).toBe(4);
    expect(r.result.passed).toBe(true);
    expect(r.state.status).toBe("PASSED");
    expect(r.changes[0].level).toBe("MASTERY_DEMONSTRATED");
    expect(r.attempts).toHaveLength(5);
  });
  it("fails below 90% and on any safety-critical error, then requires review before a reshuffled retest", () => {
    const r = submitMastery(mod, answerAll(toMastery(), { M4: [2] }));
    expect(r.result.scorePercent).toBe(75);
    expect(r.result.criticalErrors).toBe(1);
    expect(r.result.passed).toBe(false);
    expect(r.changes[0].level).toBe("REMEDIATION");
    expect(() => startRetest(mod, r.state)).toThrow(/remediation/i);
    const retest = startRetest(mod, acknowledgeCourseRemediation(r.state));
    expect(retest.mastery.attempt).toBe(2);
    expect(retest.mastery.draft).toEqual({});
  });
  it("refuses incomplete submissions", () => {
    expect(() => submitMastery(mod, saveMasteryAnswer(mod, toMastery(), "M1", [1]))).toThrow(/every question/i);
  });
});

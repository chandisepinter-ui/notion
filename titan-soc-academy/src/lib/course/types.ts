/**
 * "Course" modules — the format used by content imported from the Titan
 * Power Apps Academy build (learn cards + mcq / multi / order questions).
 *
 * The content itself is NOT stored in this repository. `npm run content:import`
 * generates it from Titan files into a git-ignored folder.
 */
import type { Stage } from "@/lib/academy/types";

export type QuestionType = "mcq" | "multi" | "order";

export type Question = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  /** mcq: [i]; multi: all correct indexes; order: indexes in correct sequence. Server-only. */
  answer: number[];
  explanation: string;
  critical: boolean;
  /** Counts toward the mastery score. False for practice and for items with an open source conflict. */
  graded: boolean;
  weight: number;
  sourceId: string | null;
  conflictId: string | null;
  verification: string;
};

export type LearnCard = { id: string; title: string; body: string; sourceId: string | null; notVerified: boolean; conflictIds?: string[] };

export type CourseStep =
  | { id: string; stage: Stage; kind: "prime"; title: string; body: string }
  | { id: string; stage: Stage; kind: "cards"; title: string; cards: LearnCard[] }
  | { id: string; stage: Stage; kind: "media"; title: string; body: string; files: string[] }
  | { id: string; stage: Stage; kind: "info"; title: string; cards: { title: string; body: string }[] }
  | { id: string; stage: Stage; kind: "practice"; title: string; items: Question[] }
  | { id: string; stage: Stage; kind: "simulation"; title: string; scenarioId: string; scenarioTitle: string; brief: string }
  | { id: string; stage: Stage; kind: "mastery"; title: string; items: Question[]; passPercent: number; simulationChecks: string[]; simulationScenarioIds?: string[] }
  | { id: string; stage: Stage; kind: "pending-source"; title: string; body: string }
  | { id: string; stage: Stage; kind: "supervisor-gate"; title: string; cards: { title: string; body: string }[] };

export type CourseModule = {
  format: "course";
  key: string;
  version: string;
  dayNumber: number;
  sortOrder: number;
  dayTitle: string;
  title: string;
  competencyTarget: string;
  domain: string;
  contentStatus: string;
  steps: CourseStep[];
};

export type SourceRecord = { id: string; title: string; path: string; date: string; status: string; note: string };
export type ConflictRecord = {
  id: string; title: string; a: string; b: string; impact: string; handling: string; owner: string; status: string; decision: string;
  /** Module IDs named in the conflict's impact (e.g. D1M03). */
  modules?: string[];
};

/** An owner ruling as shown to learners. */
export type Ruling = { conflictId: string; choice: string; ruling: string; decidedAt: number; decidedBy: string };

import type { ImmixConfig, SimScenario } from "@/lib/sim/types";

export type CourseCatalog = {
  /** Simulator scenarios (S01–S10) and IMMIX settings, from the Titan scenario catalog. */
  scenarios?: SimScenario[];
  immix?: ImmixConfig;
  generatedAt: string;
  catalogVersion: string;
  modules: CourseModule[];
  /** Modules set aside by an owner decision (e.g. Day 7 live shift replaced by the simulated shift). */
  retired: { key: string; title: string; reason: string }[];
  sources: SourceRecord[];
  conflicts: ConflictRecord[];
  day7Skills: { id: string; name: string; category: string; critical: boolean; sortOrder: number }[];
  media: { id: string; filename: string; moduleId: string; approved: boolean; status: string }[];
};

/* ------------------------------------------------------------------ */
/* Learner state                                                       */
/* ------------------------------------------------------------------ */

export type QuestionFeedback = {
  correct: boolean;
  critical: boolean;
  explanation: string;
  /** Shown only after the answer has been graded. */
  correctAnswer: string[];
};

export type CourseState = {
  stepIndex: number;
  completedSteps: string[];
  status: "IN_PROGRESS" | "REMEDIATION" | "PASSED" | "PENDING_SOURCE";
  /** Simulator runs launched from this module (recorded by the server when a run is scored). */
  sims?: Record<string, { guidedDone?: boolean; masteryPassed?: boolean; lastScore?: number; lastPassed?: boolean }>;
  cardIndex: Record<string, number>;
  practice: Record<string, { position: number; items: Record<string, { tries: number; solved: boolean; last?: number[]; feedback?: QuestionFeedback }> }>;
  mastery: {
    attempt: number;
    draft: Record<string, number[]>;
    result?: MasteryResult;
    history: { attempt: number; scorePercent: number; passed: boolean; submittedAt: number }[];
    remediationReviewed: boolean;
  };
};

export type MasteryResult = {
  attempt: number;
  scorePercent: number;
  correctCount: number;
  gradedCount: number;
  criticalErrors: number;
  passed: boolean;
  submittedAt: number;
  /** Simulator checks required for mastery (only scenarios the simulator can run). */
  simChecks?: { id: string; passed: boolean }[];
  items: {
    id: string;
    prompt: string;
    graded: boolean;
    correct: boolean;
    critical: boolean;
    chosen: string[];
    correctAnswer: string[];
    explanation: string;
    conflictId: string | null;
  }[];
};

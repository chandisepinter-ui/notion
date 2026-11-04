/**
 * Lesson system types.
 *
 * A module is pure structured content (see src/content/modules). The lesson
 * engine (engine.ts) reads that content plus a learner's saved LessonState and
 * decides what happens next. No module needs custom code.
 */

/* ------------------------------------------------------------------ */
/* Methodology                                                         */
/* ------------------------------------------------------------------ */

export type Stage = "introduce" | "demonstrate" | "guide" | "practice" | "challenge" | "verify";

export const STAGES: { key: Stage; label: string; description: string }[] = [
  { key: "introduce", label: "Introduce", description: "Learn the concept and why it matters." },
  { key: "demonstrate", label: "Demonstrate", description: "Watch the skill performed step by step." },
  { key: "guide", label: "Guide", description: "Perform it yourself with hints available." },
  { key: "practice", label: "Practice", description: "Perform it independently, with feedback." },
  { key: "challenge", label: "Challenge", description: "Handle a full realistic scenario." },
  { key: "verify", label: "Verify", description: "Demonstrate mastery. Answers revealed after you submit." },
];

/** Competency levels — completing a lesson is NOT the same as mastery. */
export type CompetencyLevel =
  | "NOT_STARTED"
  | "LEARNING"
  | "ASSISTED"
  | "PRACTICING"
  | "MASTERY_DEMONSTRATED"
  | "REMEDIATION";

export const COMPETENCY_LEVELS: Record<CompetencyLevel, { label: string; description: string; order: number }> = {
  NOT_STARTED: { label: "Not started", description: "No training activity yet.", order: 0 },
  LEARNING: { label: "Learning the concept", description: "Has been introduced to the concept.", order: 1 },
  ASSISTED: { label: "Performing with assistance", description: "Completed guided work with hints available.", order: 2 },
  PRACTICING: { label: "Practicing independently", description: "Performs correctly without assistance.", order: 3 },
  MASTERY_DEMONSTRATED: {
    label: "Mastery demonstrated",
    description: "Passed the verification assessment. Supervisor validation occurs on Day 7.",
    order: 4,
  },
  REMEDIATION: { label: "Requires remediation", description: "Assessment showed gaps that must be corrected.", order: -1 },
};

/* ------------------------------------------------------------------ */
/* Simulation content                                                  */
/* ------------------------------------------------------------------ */

export type SceneKind = "fence" | "gate" | "dock" | "lot";

export type SceneObject = (
  | { type: "person"; x: number; y: number; scale?: number; vest?: boolean; facing?: "left" | "right" }
  | { type: "animal"; species: "deer" | "raccoon"; x: number; y: number; scale?: number; facing?: "left" | "right" }
  | { type: "vehicle"; variant: "flatbed" | "sedan"; x: number; y: number; scale?: number; label?: string; loaded?: boolean; facing?: "left" | "right" }
  | { type: "debris"; x: number; y: number; scale?: number }
  | { type: "rain" }
) & {
  /** Draw the simulated analytics detection box around this object. */
  track?: boolean;
};

export type SceneFrame = {
  /** Clock time shown on the frame, HH:MM:SS */
  time: string;
  objects: SceneObject[];
  /** Plain-language description for screen readers / text mode. */
  caption: string;
};

export type Camera = { id: string; name: string; scene: SceneKind; viewNote: string };

export type ScheduleEntry = { id: string; who: string; days: string; window: string; details: string };

export type ResponseRule = { id: string; title: string; appliesWhen: string; actions: string[] };

export type SiteProfile = {
  id: string;
  siteCode: string;
  name: string;
  address: string;
  siteType: string;
  hours: string[];
  cameras: Camera[];
  schedule: ScheduleEntry[];
  responsePlan: ResponseRule[];
  contacts: { order: number; name: string; role: string; phone: string }[];
  notes: string[];
};

export type Scenario = {
  id: string;
  siteId: string;
  cameraId: string;
  eventType: string;
  day: string;
  alertTime: string;
  frames: SceneFrame[];
};

/** Things the learner can open while investigating. */
export type EvidenceKey = "clip" | "overview" | "schedule" | "plan" | "contacts";

export const EVIDENCE_LABELS: Record<EvidenceKey, string> = {
  clip: "Event clip",
  overview: "Site overview",
  schedule: "Access schedule",
  plan: "Response plan",
  contacts: "Contacts",
};

/* ------------------------------------------------------------------ */
/* Items and steps                                                     */
/* ------------------------------------------------------------------ */

export type Choice = { id: string; label: string; detail?: string };

export type Misconception = { key: string; label: string; explanations: string[] };

/**
 * One assessable decision: investigate a scenario, then choose an ACTION and
 * the RULE (from the site's response plan) that supports it.
 * Answer keys never leave the server until the attempt is graded.
 */
export type DecisionItem = {
  id: string;
  scenarioId: string;
  prompt: string;
  requiredEvidence: EvidenceKey[];
  correctAction: string;
  correctRule: string;
  /** Override the default misconception when a specific wrong action is chosen. */
  misconceptionFor?: Partial<Record<string, string>>;
  /** Why the correct answer is correct — shown only after the item is solved/graded. */
  explanation: string;
  /** Guide stage only: progressive hints. */
  hints?: string[];
  competencies: string[];
};

export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "callout"; tone: "info" | "caution" | "fictional"; title: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "sequence"; items: { title: string; text: string }[] };

export type BriefingStep = {
  id: string;
  stage: "introduce";
  kind: "briefing";
  title: string;
  task: string;
  objectives: string[];
  body: ContentBlock[];
};

export type WalkthroughPanel = {
  focus: EvidenceKey | "alert" | "decision";
  frameIndex?: number;
  title: string;
  text: string;
};

export type WalkthroughStep = {
  id: string;
  stage: "demonstrate";
  kind: "walkthrough";
  title: string;
  task: string;
  scenarioId: string;
  panels: WalkthroughPanel[];
  /** The decision being demonstrated (shown once the narration reaches the plan/decision). */
  demonstratedAnswer: ItemResponse;
};

export type DecisionStep = {
  id: string;
  stage: "guide" | "challenge";
  kind: "decision";
  title: string;
  task: string;
  item: DecisionItem;
};

export type PracticeStep = {
  id: string;
  stage: "practice";
  kind: "practice";
  title: string;
  task: string;
  items: DecisionItem[];
  /** Mastery shortcut: once this many items are correct on the FIRST try, the step is complete. */
  requiredFirstTryCorrect: number;
};

export type AssessmentStep = {
  id: string;
  stage: "verify";
  kind: "assessment";
  title: string;
  task: string;
  intro: string;
  /** Each group is one question slot; variants rotate on retakes. */
  groups: DecisionItem[][];
  passPercent: number;
};

export type LessonStep = BriefingStep | WalkthroughStep | DecisionStep | PracticeStep | AssessmentStep;

export type LessonModule = {
  key: string;
  version: number;
  dayNumber: number;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  fictionalNotice: string;
  competencies: { key: string; name: string; description: string; category: string }[];
  actions: Choice[];
  misconceptions: Misconception[];
  sites: SiteProfile[];
  scenarios: Scenario[];
  steps: LessonStep[];
  /** Items that require Titan SME approval before use as real procedure. */
  pendingApproval: string[];
};

/* ------------------------------------------------------------------ */
/* Learner state (persisted as JSON)                                   */
/* ------------------------------------------------------------------ */

export type ItemResponse = { action?: string; rule?: string };

export type Feedback = {
  correct: boolean;
  critical: boolean;
  headline: string;
  message: string;
  /** Concept explanation; included once solved. */
  explanation?: string;
  /** Different explanation shown when the same mistake repeats. */
  alternate?: { title: string; text: string };
  misconception?: string;
  /** Which parts were right (does not reveal the correct choice). */
  actionCorrect: boolean;
  ruleCorrect: boolean;
};

export type ItemState = {
  tries: number;
  solved: boolean;
  firstTryCorrect: boolean | null;
  evidence: EvidenceKey[];
  hintsShown: number;
  lastResponse?: ItemResponse;
  lastFeedback?: Feedback;
};

export type AssessmentItemResult = {
  itemId: string;
  scenarioId: string;
  correct: boolean;
  critical: boolean;
  chosen: ItemResponse;
  correctActionLabel: string;
  correctRuleLabel: string;
  explanation: string;
  misconception?: string;
};

export type AssessmentResult = {
  attempt: number;
  scorePercent: number;
  correctCount: number;
  total: number;
  criticalErrors: number;
  passed: boolean;
  items: AssessmentItemResult[];
  missedConcepts: string[];
  submittedAt: number;
};

export type LessonState = {
  stepIndex: number;
  completedSteps: string[];
  status: "IN_PROGRESS" | "REMEDIATION" | "PASSED";
  items: Record<string, ItemState>;
  walkthrough: Record<string, number>;
  practice: Record<string, { position: number; firstTryCorrect: number; reinforcement: boolean; done: boolean }>;
  misconceptions: Record<string, number>;
  assessment: {
    attempt: number;
    itemIds: string[];
    draft: Record<string, ItemResponse>;
    evidence: Record<string, EvidenceKey[]>;
    result?: AssessmentResult;
    history: { attempt: number; scorePercent: number; passed: boolean; submittedAt: number }[];
    remediationReviewed: boolean;
  };
};

export type CompetencyChange = { key: string; level: CompetencyLevel; reason: string };

export type AttemptRecord = {
  stepId: string;
  itemId: string;
  stage: Stage;
  tryNumber: number;
  assessmentAttempt?: number;
  response: ItemResponse;
  isCorrect: boolean;
  isCritical: boolean;
  misconception?: string;
  evidenceComplete: boolean;
};

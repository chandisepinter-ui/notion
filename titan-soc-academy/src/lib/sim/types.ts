/**
 * SOC simulator — scenario manifest format (as authored for the Titan Academy
 * scenario catalog, S01–S10) and the simulator's run state.
 */

export type ClipBeat = { fromSec: number; toSec: number; subject: string; x0: number; x1: number; onSite?: boolean; label: string };
export type Clip = { lengthSec: number; beats: ClipBeat[] };

export type SimAlert = {
  id: string;
  siteId: string;
  type: "HUMAN_DETECTION" | "ECARE_FAILURE" | string;
  cameraId: string;
  atMin: number;
  reconnectAtMin?: number | null;
  priorityLabel?: string;
  details: string;
  clips?: { pre?: Clip; post?: Clip };
  /** Server-only: never sent to the browser. */
  truth?: { acceptedOutcomes: string[]; actionable: boolean; onSite: boolean | null; rationale: string };
};

export type SimSite = {
  id: string;
  name: string;
  address: string;
  phone: string;
  accountId: string;
  notes: string[];
  talkdownScript: string | null;
  audioAuthorized: boolean;
  cameras: { id: string; name: string }[];
  callList: { id: string; name: string; role: string; phone: string; password?: string }[];
  boundary?: string;
  previousEvents?: { at: string; summary: string }[];
  armingSchedule?: string;
};

export type Criterion = { id: string; label: string; check: string; params?: Record<string, unknown> | null; weight: number; critical?: boolean };

export type SimScenario = {
  id: string;
  moduleId?: string;
  title: string;
  version?: number;
  status?: string;
  sourceIds?: string[];
  startLocal: string;
  brief: string;
  sites: SimSite[];
  alerts: SimAlert[];
  tasks: { id: string; label: string; hint?: string; doneWhen: string[] }[];
  criteria: Criterion[];
  escalationWithoutBasis?: { actionTypes: string[]; alertId: string; code: string };
  postTalkdownVisibility?: { cameraId: string; fromSec: number; toSec: number }[];
  /** True for built-in fictional training scenarios. */
  fictional?: boolean;
  [k: string]: unknown;
};

/** Settings that come with the scenario catalog (outcome list, default talkdown). */
export type ImmixConfig = { outcomes: string[]; defaultTalkdown: string | null };

/* ------------------------------------------------------------------ */
/* Operator actions (sent by the workstation)                          */
/* ------------------------------------------------------------------ */

export type SimAction =
  | { type: "OPEN_ALERT"; alertId: string; at: number }
  | { type: "CLIP_SEGMENT"; alertId: string; phase: "pre" | "post"; from: number; to: number; rate: number; at: number }
  | { type: "TAB_VIEWED"; alertId: string; tab: string; at: number }
  | { type: "DETAILS_VIEWED"; alertId: string; at: number }
  | { type: "CAMERA_VIEWED"; alertId: string; cameraId: string; at: number }
  | { type: "MULTIVIEW_OPEN"; alertId: string; at: number }
  | { type: "MULTIVIEW_CLOSE"; alertId: string; at: number }
  | { type: "PLAY_TALKDOWN"; alertId: string; cameraId: string; script: string; usedSiteScript: boolean; at: number }
  | { type: "CALL_START"; alertId: string; contactId: string; at: number }
  | { type: "PARK"; alertId: string; minutes: number; note: string; at: number }
  | { type: "CLOSE"; alertId: string; outcome: string; note: string; at: number }
  | { type: "BACK_TO_QUEUE"; alertId: string; at: number }
  | { type: "ACK_ALARMS"; alertId: string; at: number }
  | { type: "ADD_NOTE"; alertId: string; note: string; validFrom?: string; validTo?: string; at: number }
  | { type: "ADVANCE_TIME"; seconds: number; at: number };

export type AlertStatus = "pending" | "queued" | "open" | "parked" | "closed";

export type SimState = {
  /** Simulated seconds since scenario start. */
  clock: number;
  actions: SimAction[];
  alerts: Record<string, { status: AlertStatus; parkedAt?: number; parkMinutes?: number; reconnected?: boolean; outcome?: string; note?: string; closedAt?: number }>;
  errors: { code: string; alertId?: string; at: number; message: string }[];
  finished: boolean;
};

export type CriterionResult = { id: string; label: string; weight: number; critical: boolean; supported: boolean; passed: boolean };

export type SimResult = {
  scorePercent: number;
  passed: boolean;
  criticalFailures: number;
  earned: number;
  possible: number;
  criteria: CriterionResult[];
  errors: SimState["errors"];
  rationale: { alertId: string; text: string; accepted: string[] }[];
};

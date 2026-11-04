/**
 * SOC simulator engine — pure functions (no database, no UI).
 *
 * Replays the operator's actions against a scenario manifest, applies the
 * scenario's timeline (alerts arriving, E-CARE reconnecting, park timers),
 * flags procedural errors as they happen, and scores the run against the
 * manifest's weighted criteria. Unit-tested in tests/unit/sim-engine.test.ts.
 */
import type { CriterionResult, ImmixConfig, SimAction, SimAlert, SimResult, SimScenario, SimState } from "./types";

export const ABSENCE_REQUIRED_SEC = 120;
export const PASS_PERCENT = 90;
const MAX_ADVANCE_SEC = 60 * 60;

export class SimError extends Error {}

/* ------------------------------------------------------------------ */
/* Capability: which checks this build can evaluate                    */
/* ------------------------------------------------------------------ */

/** Checks the IMMIX workstation can evaluate today. Others need Computer 2 apps (HubSpot, TrackTik, phone, radio, Outlook/Teams). */
export const SUPPORTED_CHECKS = new Set([
  "CLIPS_REVIEWED",
  "SITE_CHECK",
  "CLOSED_AS",
  "NO_ERROR",
  "CLOSE_NOTE_HAS",
  "NOTE_HAS",
  "TALKDOWN_VALID",
  "MULTIVIEW_USED",
  "ABSENCE_VERIFIED",
  "ECARE_PARKED",
]);

export function isSupported(check: string) {
  return SUPPORTED_CHECKS.has(check);
}

function isVacuousWithoutApps(c: { check: string; params?: Record<string, unknown> | null }) {
  return c.check === "TICKETS_CREATED" && (c.params as { count?: number } | null)?.count === 0;
}

/** A scenario is playable when every critical criterion can be evaluated and it has IMMIX alerts. */
export function playability(s: SimScenario): { playable: boolean; missing: string[] } {
  const missing = [...new Set(s.criteria.filter((c) => !isSupported(c.check)).map((c) => c.check))];
  // "No ticket created" (count 0) cannot be violated while ticketing is unavailable, so it is
  // excluded from scoring rather than blocking the scenario.
  const criticalMissing = s.criteria.some((c) => c.critical && !isSupported(c.check) && !isVacuousWithoutApps(c));
  return { playable: s.alerts.length > 0 && !criticalMissing && s.criteria.some((c) => isSupported(c.check)), missing };
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export function initialSimState(s: SimScenario): SimState {
  const st: SimState = {
    clock: 0,
    actions: [],
    alerts: Object.fromEntries(s.alerts.map((a) => [a.id, { status: "pending" as const }])),
    errors: [],
    finished: false,
  };
  return tick(s, st);
}

/** Applies everything the clock has reached: arriving alerts, E-CARE reconnects, expired parks. */
export function tick(s: SimScenario, st: SimState): SimState {
  for (const a of s.alerts) {
    const as = st.alerts[a.id];
    if (as.status === "pending" && st.clock >= a.atMin * 60) as.status = "queued";
    if (a.reconnectAtMin != null && !as.reconnected && st.clock >= a.reconnectAtMin * 60 && as.status !== "pending" && as.status !== "closed") {
      as.reconnected = true;
      if (as.status === "parked") as.status = "queued";
    }
    if (as.status === "parked" && as.parkedAt != null && as.parkMinutes != null && st.clock >= as.parkedAt + as.parkMinutes * 60) {
      as.status = "queued";
    }
  }
  return st;
}

/** Seconds until the next scheduled timeline event (for the "skip ahead" control), or null. */
export function nextTimelineEvent(s: SimScenario, st: SimState): number | null {
  const times: number[] = [];
  for (const a of s.alerts) {
    const as = st.alerts[a.id];
    if (as.status === "pending") times.push(a.atMin * 60);
    if (a.reconnectAtMin != null && !as.reconnected && as.status !== "closed") times.push(a.reconnectAtMin * 60);
    if (as.status === "parked" && as.parkedAt != null && as.parkMinutes != null) times.push(as.parkedAt + as.parkMinutes * 60);
  }
  const future = times.filter((t) => t > st.clock);
  return future.length ? Math.min(...future) - st.clock : null;
}

/* ------------------------------------------------------------------ */
/* Visibility (what the live cameras show)                             */
/* ------------------------------------------------------------------ */

function talkdowns(st: SimState) {
  return st.actions.filter((a): a is Extract<SimAction, { type: "PLAY_TALKDOWN" }> => a.type === "PLAY_TALKDOWN");
}

/** Absolute time the subject was last visible on any camera after the first talkdown, or null if no talkdown yet. */
export function lastVisibleAfterTalkdown(s: SimScenario, st: SimState): number | null {
  const td = talkdowns(st)[0];
  if (!td || !s.postTalkdownVisibility?.length) return null;
  return td.at + Math.max(...s.postTalkdownVisibility.map((v) => v.toSec));
}

/** Is a subject visible on this camera at time t? Returns the subject's position if so. */
export function subjectOnCamera(s: SimScenario, st: SimState, cameraId: string, t: number): { x: number; onSite: boolean; label: string } | null {
  for (const a of s.alerts) {
    if (a.type !== "HUMAN_DETECTION" || !a.clips) continue;
    const start = a.atMin * 60;
    if (t < start) continue;
    const lastBeat = (a.clips.post ?? a.clips.pre)?.beats.at(-1);
    const pos = { x: lastBeat?.x1 ?? 0.5, onSite: lastBeat?.onSite ?? false, label: lastBeat?.label ?? "" };
    const td = talkdowns(st).find((x) => x.alertId === a.id);
    if (td && s.postTalkdownVisibility?.length) {
      const rel = t - td.at;
      if (rel < 0) {
        if (cameraId === a.cameraId) return pos;
        continue;
      }
      const v = s.postTalkdownVisibility.find((p) => p.cameraId === cameraId && rel >= p.fromSec && rel < p.toSec);
      if (v) return { ...pos, x: cameraId === a.cameraId ? pos.x : 0.5 + 0.4 * Math.sin(rel / 6) };
      continue;
    }
    if (cameraId !== a.cameraId) continue;
    // Without a talkdown sequence, subjects who are off site move on; on-site subjects stay.
    if (pos.onSite || s.postTalkdownVisibility?.length) return pos;
    if (t < start + 90) return { ...pos, x: Math.min(0.95, pos.x + (t - start) / 400) };
  }
  return null;
}

/** Multiview sessions as [open, close] (close = now if still open). */
export function multiviewSessions(st: SimState): [number, number][] {
  const out: [number, number][] = [];
  let open: number | null = null;
  for (const a of st.actions) {
    if (a.type === "MULTIVIEW_OPEN" && open === null) open = a.at;
    if (a.type === "MULTIVIEW_CLOSE" && open !== null) {
      out.push([open, a.at]);
      open = null;
    }
  }
  if (open !== null) out.push([open, st.clock]);
  return out;
}

/** True once Multiview was watched continuously for 120 s after the subject left every camera. */
export function absenceVerified(s: SimScenario, st: SimState): boolean {
  const last = lastVisibleAfterTalkdown(s, st);
  if (last === null) return false;
  return multiviewSessions(st).some(([o, c]) => o <= last + 1 && c >= last + ABSENCE_REQUIRED_SEC);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const alertById = (s: SimScenario, id: string) => {
  const a = s.alerts.find((x) => x.id === id);
  if (!a) throw new SimError("Unknown alert.");
  return a;
};

export function applyAction(s: SimScenario, cfg: ImmixConfig, input: SimState, action: SimAction): SimState {
  const st: SimState = structuredClone(input);
  if (st.finished) throw new SimError("This run has already been submitted.");
  if (!Number.isFinite(action.at) || action.at < 0) throw new SimError("Invalid time.");
  // Clock only moves forward.
  st.clock = Math.max(st.clock, action.at);
  if (action.type === "ADVANCE_TIME") {
    if (!(action.seconds > 0 && action.seconds <= MAX_ADVANCE_SEC)) throw new SimError("Invalid time advance.");
    if (isMultiviewOpen(st)) {
      throw new SimError("Close Multiview before skipping ahead — absence must be watched live.");
    }
    st.clock += action.seconds;
    st.actions.push({ ...action, at: st.clock });
    return tick(s, st);
  }
  tick(s, st);
  const flag = (code: string, message: string, alertId?: string) => st.errors.push({ code, alertId, at: st.clock, message });

  if ("alertId" in action) {
    const a = alertById(s, action.alertId);
    const as = st.alerts[a.id];
    if (as.status === "pending") throw new SimError("That alert has not arrived yet.");

    switch (action.type) {
      case "OPEN_ALERT":
        if (as.status === "closed") throw new SimError("That event is closed.");
        if (as.status === "parked") as.parkedAt = undefined; // unparked by the operator
        as.status = "open";
        break;
      case "BACK_TO_QUEUE":
        if (as.status === "open") as.status = "queued";
        break;
      case "PLAY_TALKDOWN":
      case "CALL_START": {
        const e = s.escalationWithoutBasis;
        if (e && e.alertId === a.id && e.actionTypes.includes(action.type)) {
          flag(e.code, "Escalated an alert the site instructions do not treat as actionable.", a.id);
        }
        break;
      }
      case "PARK": {
        if (as.status === "closed") throw new SimError("That event is closed.");
        if (!(action.minutes > 0 && action.minutes <= 24 * 60)) throw new SimError("Enter how long to park the event.");
        if (a.type !== "ECARE_FAILURE") {
          const ecareOnAccount = s.alerts.some((x) => x.type === "ECARE_FAILURE" && x.siteId === a.siteId && st.alerts[x.id].status !== "pending");
          flag(ecareOnAccount ? "PARKED_OVERLAP_ALERT" : "PARKED_HUMAN_ALERT", "Parked an alert that must be worked, not parked.", a.id);
        }
        as.status = "parked";
        as.parkedAt = st.clock;
        as.parkMinutes = action.minutes;
        break;
      }
      case "CLOSE": {
        if (as.status === "closed") throw new SimError("That event is already closed.");
        if (!cfg.outcomes.includes(action.outcome)) throw new SimError("Choose an outcome from the list.");
        if (a.type === "ECARE_FAILURE" && !as.reconnected) {
          flag("ECARE_CLOSE_UNRESOLVED", "Closed an E-CARE failure that had not reconnected and had no ticket.", a.id);
        }
        const isTalkdownAlert = !!s.postTalkdownVisibility?.length && a.type === "HUMAN_DETECTION" && a.truth?.actionable;
        if (isTalkdownAlert && a.truth?.acceptedOutcomes.includes(action.outcome) && !absenceVerified(s, st)) {
          flag("TALKDOWN_SUCCESS_UNVERIFIED", "Closed as a successful talkdown before verifying 2 minutes of absence on all cameras.", a.id);
        }
        as.status = "closed";
        as.outcome = action.outcome;
        as.note = action.note.slice(0, 5000);
        as.closedAt = st.clock;
        break;
      }
    }
  }
  st.actions.push(action);
  return st;
}

export function isMultiviewOpen(st: SimState) {
  let open = false;
  for (const a of st.actions) {
    if (a.type === "MULTIVIEW_OPEN") open = true;
    if (a.type === "MULTIVIEW_CLOSE") open = false;
  }
  return open;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** Union of 1x playback segments covers the whole clip (scrubbing and other speeds do not count). */
export function clipWatched(st: SimState, alertId: string, phase: "pre" | "post", length: number): boolean {
  const segs = st.actions
    .filter((a): a is Extract<SimAction, { type: "CLIP_SEGMENT" }> => a.type === "CLIP_SEGMENT" && a.alertId === alertId && a.phase === phase && a.rate === 1)
    .map((a) => [Math.max(0, a.from), Math.min(length, a.to)] as [number, number])
    .filter(([f, t]) => t > f)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0;
  for (const [f, t] of segs) {
    if (f > covered + 0.6) return false;
    covered = Math.max(covered, t);
  }
  return covered >= length - 0.6;
}

function talkdownValid(s: SimScenario, cfg: ImmixConfig, alert: SimAlert, td: Extract<SimAction, { type: "PLAY_TALKDOWN" }>): boolean {
  const site = s.sites.find((x) => x.id === alert.siteId);
  if (!site?.audioAuthorized) return false;
  const speakers = site.cameras.filter((c) => /speaker/i.test(c.name));
  if (speakers.length && !speakers.some((c) => c.id === td.cameraId)) return false;
  const text = td.script.toLowerCase();
  if (site.talkdownScript) return td.usedSiteScript;
  if (td.usedSiteScript) return false;
  // Default script: the site's name filled in, a subject description filled in, no unfilled [placeholders].
  const filled = !/\[[^\]]*\]/.test(td.script);
  const named = text.includes(site.name.toLowerCase()) || text.includes(site.name.toLowerCase().replace(/^training site - /, ""));
  const base = cfg.defaultTalkdown?.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 30);
  const fromTemplate = !base || text.replace(/\s+/g, " ").includes(base);
  return filled && named && fromTemplate && td.script.length >= 40;
}

export function evaluate(s: SimScenario, cfg: ImmixConfig, st: SimState): SimResult {
  const closeOf = (id: string) => st.alerts[id];
  const results: CriterionResult[] = s.criteria.map((c) => {
    const p = (c.params ?? {}) as Record<string, unknown>;
    const alertId = p.alert as string | undefined;
    const alert = alertId ? s.alerts.find((a) => a.id === alertId) : undefined;
    let supported = isSupported(c.check);
    let passed = false;
    if (supported) {
      switch (c.check) {
        case "CLIPS_REVIEWED":
          passed = !!alert?.clips && (["pre", "post"] as const).every((ph) => !alert.clips![ph] || clipWatched(st, alert.id, ph, alert.clips![ph]!.lengthSec));
          break;
        case "SITE_CHECK":
          passed = st.actions.some((a) => a.type === "TAB_VIEWED" && a.tab === p.tab && s.alerts.find((x) => x.id === a.alertId)?.siteId === p.site);
          break;
        case "CLOSED_AS":
          passed = !!alert && closeOf(alert.id).status === "closed" && !!alert.truth?.acceptedOutcomes.includes(closeOf(alert.id).outcome ?? "");
          break;
        case "NO_ERROR":
          passed = !st.errors.some((e) => ((p.codes as string[]) ?? []).includes(e.code));
          break;
        case "CLOSE_NOTE_HAS": {
          const note = (alert ? closeOf(alert.id).note ?? "" : "").toLowerCase();
          passed = !!alert && closeOf(alert.id).status === "closed" && ((p.all as string[]) ?? []).every((w) => note.includes(w.toLowerCase()));
          break;
        }
        case "NOTE_HAS": {
          const notes = [
            ...Object.values(st.alerts).map((a) => a.note ?? ""),
            ...st.actions.filter((a) => a.type === "PARK").map((a) => (a as { note: string }).note),
          ].join(" \n ").toLowerCase();
          passed = ((p.all as string[]) ?? []).every((w) => notes.includes(w.toLowerCase()));
          break;
        }
        case "TALKDOWN_VALID":
          passed = !!alert && talkdowns(st).some((td) => td.alertId === alert.id && talkdownValid(s, cfg, alert, td));
          break;
        case "MULTIVIEW_USED":
          passed = st.actions.some((a) => a.type === "MULTIVIEW_OPEN");
          break;
        case "ABSENCE_VERIFIED":
          passed = absenceVerified(s, st);
          break;
        case "ECARE_PARKED":
          passed = !!alert && st.actions.some((a) => a.type === "PARK" && a.alertId === alert.id);
          break;
        default:
          supported = false;
      }
    }
    return { id: c.id, label: c.label, weight: c.weight, critical: !!c.critical, supported, passed };
  });
  const counted = results.filter((r) => r.supported);
  const possible = counted.reduce((n, r) => n + r.weight, 0);
  const earned = counted.filter((r) => r.passed).reduce((n, r) => n + r.weight, 0);
  const criticalFailures = counted.filter((r) => r.critical && !r.passed).length;
  const scorePercent = possible ? Math.round((earned / possible) * 100) : 0;
  return {
    scorePercent,
    passed: possible > 0 && scorePercent >= PASS_PERCENT && criticalFailures === 0,
    criticalFailures,
    earned,
    possible,
    criteria: results,
    errors: st.errors,
    rationale: s.alerts.map((a) => ({ alertId: a.id, text: a.truth?.rationale ?? "", accepted: a.truth?.acceptedOutcomes ?? [] })),
  };
}

/** Task checklist progress (guided mode): a task is done when all its criteria pass. */
export function taskProgress(s: SimScenario, cfg: ImmixConfig, st: SimState) {
  const r = evaluate(s, cfg, st);
  const byId = new Map(r.criteria.map((c) => [c.id, c]));
  return s.tasks.map((t) => {
    const crit = t.doneWhen.map((id) => byId.get(id)).filter(Boolean) as CriterionResult[];
    const supported = crit.filter((c) => c.supported);
    return { id: t.id, done: supported.length > 0 && supported.every((c) => c.passed), supported: supported.length > 0 };
  });
}

/* ------------------------------------------------------------------ */
/* Client-safe scenario                                                */
/* ------------------------------------------------------------------ */

/** Removes answer keys (truth, scoring rules, escalation rules) before the scenario reaches the browser. */
export function sanitizeScenario(s: SimScenario) {
  return {
    id: s.id,
    title: s.title,
    brief: s.brief,
    startLocal: s.startLocal,
    fictional: !!s.fictional,
    sites: s.sites.map((x) => ({ ...x, callList: x.callList.map(({ password: _pw, ...c }) => c) })),
    alerts: s.alerts.map(({ truth: _t, clips, ...a }) => ({
      ...a,
      clips: clips
        ? Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, c ? { lengthSec: c.lengthSec, beats: c.beats.map(({ onSite, ...b }) => ({ ...b, onSite: !!onSite })) } : c]))
        : undefined,
    })),
    tasks: s.tasks.map((t) => ({ id: t.id, label: t.label, hint: t.hint ?? "" })),
    postTalkdownVisibility: s.postTalkdownVisibility ?? [],
  };
}
export type ClientScenario = ReturnType<typeof sanitizeScenario>;

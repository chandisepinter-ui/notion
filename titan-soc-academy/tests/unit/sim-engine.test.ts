/** Simulator engine tests — fictional built-in scenario plus small synthetic manifests. */
import { describe, expect, it } from "vitest";
import {
  outcomeAccepted,
  absenceVerified, applyAction, clipWatched, evaluate, initialSimState, nextTimelineEvent, playability, sanitizeScenario, SimError, subjectOnCamera,
} from "@/lib/sim/engine";
import { BUILTIN_IMMIX_CONFIG as cfg, BUILTIN_SCENARIOS } from "@/content/sim/builtin-scenarios";
import type { SimAction, SimScenario, SimState } from "@/lib/sim/types";

const scn = BUILTIN_SCENARIOS[0];
const run = (actions: SimAction[], s: SimScenario = scn, st: SimState = initialSimState(s)) => actions.reduce((acc, a) => applyAction(s, cfg, acc, a), st);

const perfect: SimAction[] = [
  { type: "OPEN_ALERT", alertId: "A1", at: 1 },
  { type: "CLIP_SEGMENT", alertId: "A1", phase: "pre", from: 0, to: 12, rate: 1, at: 14 },
  { type: "CLIP_SEGMENT", alertId: "A1", phase: "post", from: 0, to: 12, rate: 1, at: 27 },
  { type: "TAB_VIEWED", alertId: "A1", tab: "notes", at: 30 },
  { type: "TAB_VIEWED", alertId: "A1", tab: "map", at: 32 },
  { type: "PLAY_TALKDOWN", alertId: "A1", cameraId: "CAM 04 Speaker", script: scn.sites[0].talkdownScript!, usedSiteScript: true, at: 40 },
  { type: "MULTIVIEW_OPEN", alertId: "A1", at: 45 },
  { type: "MULTIVIEW_CLOSE", alertId: "A1", at: 40 + 30 + 125 },
  { type: "CLOSE", alertId: "A1", outcome: "Action Taken", subOutcome: "Talkdown Successful", note: "Talkdown played; MultiView showed no one for 2 minutes.", at: 200 },
];

describe("simulator engine", () => {
  it("built-in scenario is playable and sanitized for the browser", () => {
    expect(playability(scn).playable).toBe(true);
    const json = JSON.stringify(sanitizeScenario(scn));
    expect(json).not.toContain("acceptedOutcomes");
    expect(json).not.toContain("criteria");
    expect(json).not.toContain("Lighthouse"); // call-list password
  });

  it("a correct run scores 100% and passes", () => {
    const r = evaluate(scn, cfg, run(perfect));
    expect(r.criteria.filter((c) => !c.passed).map((c) => c.id)).toEqual([]);
    expect(r.scorePercent).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("only continuous 1x playback counts as reviewing a clip", () => {
    const st = run([
      { type: "CLIP_SEGMENT", alertId: "A1", phase: "pre", from: 0, to: 5, rate: 1, at: 5 },
      { type: "CLIP_SEGMENT", alertId: "A1", phase: "pre", from: 9, to: 12, rate: 1, at: 8 },
      { type: "CLIP_SEGMENT", alertId: "A1", phase: "post", from: 0, to: 12, rate: 2, at: 14 },
    ]);
    expect(clipWatched(st, "A1", "pre", 12)).toBe(false); // gap 5–9 was scrubbed
    expect(clipWatched(st, "A1", "post", 12)).toBe(false); // played at 2x
  });

  it("closing as a successful talkdown before 2 minutes of absence is a critical error", () => {
    const early = perfect.slice(0, 7).concat([{ type: "CLOSE", alertId: "A1", outcome: "Action Taken", subOutcome: "Talkdown Successful", note: "talkdown multiview", at: 100 }]);
    const st = run(early);
    expect(absenceVerified(scn, st)).toBe(false);
    const r = evaluate(scn, cfg, st);
    expect(st.errors.map((e) => e.code)).toContain("TALKDOWN_SUCCESS_UNVERIFIED");
    expect(r.passed).toBe(false);
    expect(r.criticalFailures).toBeGreaterThan(0);
  });

  it("MultiView must stay open through the whole absence window", () => {
    const gap = [...perfect.slice(0, 6),
      { type: "MULTIVIEW_OPEN", alertId: "A1", at: 70 } as SimAction,
      { type: "MULTIVIEW_CLOSE", alertId: "A1", at: 120 } as SimAction,
      { type: "MULTIVIEW_OPEN", alertId: "A1", at: 130 } as SimAction,
      { type: "MULTIVIEW_CLOSE", alertId: "A1", at: 260 } as SimAction];
    expect(absenceVerified(scn, run(gap))).toBe(false);
  });

  it("the subject is visible until the talkdown, then moves between cameras and leaves", () => {
    const before = run([{ type: "OPEN_ALERT", alertId: "A1", at: 1 }]);
    expect(subjectOnCamera(scn, before, "CAM 01", 30)).not.toBeNull();
    const after = run(perfect.slice(0, 6));
    expect(subjectOnCamera(scn, after, "CAM 01", 45)).not.toBeNull();
    expect(subjectOnCamera(scn, after, "CAM 03", 60)).not.toBeNull();
    expect(subjectOnCamera(scn, after, "CAM 01", 80)).toBeNull();
    expect(subjectOnCamera(scn, after, "CAM 03", 80)).toBeNull();
  });

  it("rejects outcomes that are not on the list and actions on closed events", () => {
    expect(() => run([{ type: "CLOSE", alertId: "A1", outcome: "Made up", note: "", at: 5 }])).toThrow(SimError);
    const closed = run(perfect);
    expect(() => run([{ type: "OPEN_ALERT", alertId: "A1", at: 300 }], scn, closed)).toThrow(/closed/);
  });
});

describe("timeline (E-CARE)", () => {
  const ecare: SimScenario = {
    id: "T-ECARE", title: "t", startLocal: "2026-01-01T00:00:00", brief: "",
    sites: [{ ...scn.sites[0], id: "S" }],
    alerts: [{ id: "A1", siteId: "S", type: "ECARE_FAILURE", cameraId: "CAM 04 Speaker", atMin: 0, reconnectAtMin: 12, details: "fail", truth: { acceptedOutcomes: ["eCare"], actionable: false, onSite: null, rationale: "" } }],
    tasks: [],
    criteria: [
      { id: "c1", label: "parked", check: "ECARE_PARKED", params: { alert: "A1" }, weight: 2, critical: true },
      { id: "c2", label: "no ticket", check: "TICKETS_CREATED", params: { count: 0 }, weight: 3, critical: true },
      { id: "c3", label: "closed", check: "CLOSED_AS", params: { alert: "A1" }, weight: 3 },
      { id: "c4", label: "no unresolved close", check: "NO_ERROR", params: { codes: ["ECARE_CLOSE_UNRESOLVED"] }, weight: 1 },
    ],
  };
  const ecfg = { outcomes: ["eCare", "Nuisance"], defaultTalkdown: null };

  it("is playable; 'no ticket' is excluded from scoring while ticketing is unavailable", () => {
    expect(playability(ecare).playable).toBe(true);
    const st = [
      { type: "OPEN_ALERT", alertId: "A1", at: 5 },
      { type: "PARK", alertId: "A1", minutes: 30, note: "standard park", at: 10 },
    ].reduce((s, a) => applyAction(ecare, ecfg, s, a as SimAction), initialSimState(ecare));
    expect(nextTimelineEvent(ecare, st)).toBe(12 * 60 - 10);
    const skipped = applyAction(ecare, ecfg, st, { type: "ADVANCE_TIME", seconds: 710, at: 10 });
    expect(skipped.alerts.A1.reconnected).toBe(true);
    expect(skipped.alerts.A1.status).toBe("queued");
    const done = applyAction(ecare, ecfg, applyAction(ecare, ecfg, skipped, { type: "OPEN_ALERT", alertId: "A1", at: 721 }), { type: "CLOSE", alertId: "A1", outcome: "eCare", note: "reconnected", at: 725 });
    const r = evaluate(ecare, ecfg, done);
    expect(r.criteria.find((c) => c.id === "c2")?.supported).toBe(false);
    expect(r.passed).toBe(true);
  });

  it("closing before reconnect is flagged", () => {
    const st = applyAction(ecare, ecfg, initialSimState(ecare), { type: "CLOSE", alertId: "A1", outcome: "eCare", note: "", at: 30 });
    expect(st.errors[0].code).toBe("ECARE_CLOSE_UNRESOLVED");
  });
});

describe("two-level close-out (live IMMIX lists)", () => {
  it("requires the second-level outcome when the category has one", () => {
    expect(() => run([{ type: "CLOSE", alertId: "A1", outcome: "Action Taken", note: "", at: 5 }])).toThrow(/second list/);
  });
  it("accepts a category, a sub-outcome, or an alias (pending C12)", () => {
    const live = { outcomes: ["Incident/Action Taken", "Off Site Activity"], subOutcomes: {}, aliases: { "Audio Talk Down Threat Eliminated": ["Incident/Action Taken > Successful Audio Talkdown"] }, defaultTalkdown: null };
    expect(outcomeAccepted(live, ["Off Site Activity"], "Off Site Activity", "Person Seen Off Site")).toBe(true);
    expect(outcomeAccepted(live, ["Audio Talk Down Threat Eliminated"], "Incident/Action Taken", "Successful Audio Talkdown")).toBe(true);
    expect(outcomeAccepted(live, ["Audio Talk Down Threat Eliminated"], "Incident/Action Taken", "Police Responded")).toBe(false);
  });
  it("a documented call (Notification: Call Made) counts as escalating an off-site alert", () => {
    const s: SimScenario = { ...scn, escalationWithoutBasis: { actionTypes: ["PLAY_TALKDOWN", "CALL_START"], alertId: "A1", code: "ESCALATION_WITHOUT_BASIS" } };
    const noAnswer = run([{ type: "NOTIFICATION", alertId: "A1", contactType: "Subscriber", result: "No Answer", details: "", at: 5 }], s);
    expect(noAnswer.errors).toHaveLength(0);
    const made = run([{ type: "NOTIFICATION", alertId: "A1", contactType: "Police", result: "Call Made", details: "called PD", at: 5 }], s);
    expect(made.errors[0]?.code).toBe("ESCALATION_WITHOUT_BASIS");
  });
});

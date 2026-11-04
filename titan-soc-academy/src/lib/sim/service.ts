import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { evaluate, initialSimState, isSupported, nextTimelineEvent, sanitizeScenario, taskProgress } from "./engine";
import { getScenario } from "./catalog";
import type { SimResult, SimState } from "./types";

export type RunMode = "practice" | "guided" | "mastery";

export async function loadRun(runId: string, userId: string) {
  const run = await db.query.simRuns.findFirst({ where: and(eq(schema.simRuns.id, runId), eq(schema.simRuns.userId, userId)) });
  if (!run) return null;
  const entry = getScenario(run.scenarioId);
  if (!entry) return null;
  return { run, entry, state: JSON.parse(run.stateJson) as SimState };
}

export async function createRun(userId: string, scenarioId: string, mode: RunMode, moduleKey: string | null) {
  const entry = getScenario(scenarioId);
  if (!entry || !entry.playable) throw new Error("This scenario is not available in the simulator yet.");
  const [row] = await db
    .insert(schema.simRuns)
    .values({ userId, scenarioId, mode, moduleKey, stateJson: JSON.stringify(initialSimState(entry.scenario)), updatedAt: new Date() })
    .returning();
  return row.id;
}

/** What the workstation receives. Answer keys and scoring rules are never included. */
export function runView(run: { id: string; mode: string; moduleKey: string | null; status: string; resultJson: string | null }, entry: NonNullable<ReturnType<typeof getScenario>>, state: SimState) {
  const coached = run.mode !== "mastery";
  return {
    runId: run.id,
    mode: run.mode as RunMode,
    moduleKey: run.moduleKey,
    status: run.status,
    scenario: sanitizeScenario(entry.scenario),
    outcomes: entry.config.outcomes,
    defaultTalkdown: entry.config.defaultTalkdown,
    /** Criteria this build cannot evaluate yet (they need Computer 2 apps); excluded from the score. */
    unsupported: entry.scenario.criteria.filter((c) => !isSupported(c.check)).map((c) => c.label),
    state: {
      clock: state.clock,
      alerts: state.alerts,
      actions: state.actions,
      errors: coached ? state.errors : [],
      finished: state.finished,
    },
    tasks: coached ? taskProgress(entry.scenario, entry.config, state) : null,
    nextEvent: nextTimelineEvent(entry.scenario, state),
    result: run.resultJson ? (JSON.parse(run.resultJson) as SimResult) : null,
  };
}
export type RunView = ReturnType<typeof runView>;

export function score(entry: NonNullable<ReturnType<typeof getScenario>>, state: SimState) {
  return evaluate(entry.scenario, entry.config, state);
}

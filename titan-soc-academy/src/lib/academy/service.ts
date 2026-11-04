import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getLessonModule } from "@/content/curriculum";
import { initialState, parseState } from "./engine";
import { COMPETENCY_LEVELS, type AttemptRecord, type CompetencyChange, type CompetencyLevel, type LessonModule, type LessonState } from "./types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getModuleRow(key: string) {
  return db.query.modules.findFirst({ where: eq(schema.modules.key, key) });
}

export async function loadLesson(userId: string, moduleKey: string) {
  const content = getLessonModule(moduleKey);
  const row = await getModuleRow(moduleKey);
  if (!content || !row || row.status !== "AVAILABLE") return null;
  const progress = await db.query.moduleProgress.findFirst({
    where: and(eq(schema.moduleProgress.userId, userId), eq(schema.moduleProgress.moduleId, row.id)),
  });
  return { content, row, progress, state: progress ? parseState(progress.stateJson) : initialState() };
}

/**
 * Decides whether a competency change should be applied:
 *  - Mastery and Remediation always apply (they are verification outcomes).
 *  - While in Remediation, lesser levels do not clear it (only passing does).
 *  - Otherwise levels only move upward.
 */
export function resolveLevel(current: CompetencyLevel, proposed: CompetencyLevel): CompetencyLevel {
  if (proposed === "MASTERY_DEMONSTRATED" || proposed === "REMEDIATION") return proposed;
  if (current === "REMEDIATION") return current;
  return COMPETENCY_LEVELS[proposed].order > COMPETENCY_LEVELS[current].order ? proposed : current;
}

async function applyCompetencyChanges(tx: Tx, userId: string, changes: CompetencyChange[]) {
  if (!changes.length) return;
  const keys = [...new Set(changes.map((c) => c.key))];
  const comps = await tx.select().from(schema.competencies).where(inArray(schema.competencies.key, keys));
  const now = new Date();
  for (const change of changes) {
    const comp = comps.find((c) => c.key === change.key);
    if (!comp) continue;
    const existing = await tx.query.competencyRecords.findFirst({
      where: and(eq(schema.competencyRecords.userId, userId), eq(schema.competencyRecords.competencyId, comp.id)),
    });
    const from = (existing?.level ?? "NOT_STARTED") as CompetencyLevel;
    const to = resolveLevel(from, change.level);
    if (to === from && change.level !== "ASSISTED") continue;
    if (to === from) {
      // Same level, but record a reinforcement note (e.g., practice target missed).
      if (existing) await tx.update(schema.competencyRecords).set({ note: change.reason, updatedAt: now }).where(eq(schema.competencyRecords.id, existing.id));
      continue;
    }
    if (existing) {
      await tx.update(schema.competencyRecords).set({ level: to, note: change.reason, updatedAt: now }).where(eq(schema.competencyRecords.id, existing.id));
    } else {
      await tx.insert(schema.competencyRecords).values({ userId, competencyId: comp.id, level: to, note: change.reason, updatedAt: now });
    }
    await tx.insert(schema.competencyEvents).values({ userId, competencyId: comp.id, fromLevel: from, toLevel: to, reason: change.reason });
  }
}

export async function persistLesson(args: {
  userId: string;
  content: LessonModule;
  moduleId: string;
  state: LessonState;
  attempts?: AttemptRecord[];
  changes?: CompetencyChange[];
  scorePercent?: number;
}) {
  const { state } = args;
  return persistProgress({
    userId: args.userId,
    moduleId: args.moduleId,
    status: state.status,
    stepIndex: state.stepIndex,
    stateJson: JSON.stringify(state),
    contentVersion: args.content.version,
    assessmentAttempts: state.assessment.history.length,
    attempts: args.attempts,
    changes: args.changes,
    scorePercent: args.scorePercent,
  });
}

/** Saves progress, graded attempts and competency changes in one transaction (any module format). */
export async function persistProgress(args: {
  userId: string;
  moduleId: string;
  status: "IN_PROGRESS" | "REMEDIATION" | "PASSED" | "PENDING_SOURCE";
  stepIndex: number;
  stateJson: string;
  contentVersion: number;
  assessmentAttempts: number;
  attempts?: AttemptRecord[];
  changes?: CompetencyChange[];
  scorePercent?: number;
}) {
  const { userId, moduleId, status, attempts = [], changes = [] } = args;
  const now = new Date();
  await db.transaction(async (tx) => {
    const existing = await tx.query.moduleProgress.findFirst({
      where: and(eq(schema.moduleProgress.userId, userId), eq(schema.moduleProgress.moduleId, moduleId)),
    });
    const bestScore =
      args.scorePercent !== undefined ? Math.max(existing?.bestScore ?? 0, args.scorePercent) : existing?.bestScore ?? null;
    const values = {
      status,
      currentStepIndex: args.stepIndex,
      stateJson: args.stateJson,
      contentVersion: args.contentVersion,
      assessmentAttempts: args.assessmentAttempts,
      bestScore,
      updatedAt: now,
      completedAt: status === "PASSED" ? existing?.completedAt ?? now : null,
    };
    if (existing) {
      await tx.update(schema.moduleProgress).set(values).where(eq(schema.moduleProgress.id, existing.id));
    } else {
      await tx.insert(schema.moduleProgress).values({ userId, moduleId, startedAt: now, ...values });
    }
    if (attempts.length) {
      await tx.insert(schema.trainingAttempts).values(
        attempts.map((a) => ({
          userId,
          moduleId,
          stepId: a.stepId,
          itemId: a.itemId,
          stage: a.stage,
          tryNumber: a.tryNumber,
          assessmentAttempt: a.assessmentAttempt ?? null,
          responseJson: JSON.stringify(a.response),
          isCorrect: a.isCorrect,
          isCritical: a.isCritical,
          misconception: a.misconception ?? null,
          evidenceComplete: a.evidenceComplete,
        })),
      );
    }
    await applyCompetencyChanges(tx, userId, changes);
  });
}

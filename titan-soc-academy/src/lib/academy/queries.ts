import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getLessonModule } from "@/content/curriculum";
import { getCourseModule } from "@/content/titan-catalog";
import { parseCourseState } from "@/lib/course/engine";
import { parseState } from "./engine";
import { STAGES } from "./types";

export type ModuleWithProgress = {
  id: string;
  key: string;
  dayNumber: number;
  title: string;
  summary: string;
  status: string;
  isPreview: boolean;
  estimatedMinutes: number | null;
  format: string;
  origin: string;
  contentStatus: string | null;
  /** Locked until earlier modules are complete (operators). */
  locked: boolean;
  progress: {
    status: string;
    percent: number;
    stageLabel: string | null;
    bestScore: number | null;
    assessmentAttempts: number;
    updatedAt: Date | null;
    completedAt: Date | null;
  } | null;
};

/** Percent of a module completed, based on completed steps (honest, step-based). */
function percentFor(moduleKey: string, stateJson: string, status: string) {
  if (status === "PASSED") return { percent: 100, stageLabel: "Complete" };
  const course = getCourseModule(moduleKey);
  if (course) {
    const st = parseCourseState(stateJson);
    if (status === "PENDING_SOURCE") return { percent: 100, stageLabel: "Completed — pending source" };
    const step = course.steps[Math.min(st.stepIndex, course.steps.length - 1)];
    return {
      percent: Math.round((st.completedSteps.length / course.steps.length) * 100),
      stageLabel: STAGES.find((x) => x.key === step.stage)?.label ?? null,
    };
  }
  const content = getLessonModule(moduleKey);
  if (!content) return { percent: 0, stageLabel: null as string | null };
  if (status === "PASSED") return { percent: 100, stageLabel: "Complete" };
  const st = parseState(stateJson);
  const step = content.steps[Math.min(st.stepIndex, content.steps.length - 1)];
  const label = STAGES.find((s) => s.key === step.stage)?.label ?? null;
  return { percent: Math.round((st.completedSteps.length / content.steps.length) * 100), stageLabel: label };
}

/** Statuses that let the next module unlock. */
const DONE = new Set(["PASSED", "PENDING_SOURCE"]);

export async function getModulesWithProgress(userId: string, opts: { previewAll?: boolean } = {}): Promise<ModuleWithProgress[]> {
  const mods = await db.select().from(schema.modules).orderBy(asc(schema.modules.dayNumber), asc(schema.modules.sortOrder));
  const prog = await db.select().from(schema.moduleProgress).where(eq(schema.moduleProgress.userId, userId));
  // Titan course modules unlock in order: each opens once every earlier one is complete.
  let blocked = false;
  const lockedKeys = new Set<string>();
  for (const m of mods.filter((x) => x.format === "course" && x.status === "AVAILABLE")) {
    if (blocked && !opts.previewAll) lockedKeys.add(m.key);
    if (!DONE.has(prog.find((p) => p.moduleId === m.id)?.status ?? "")) blocked = true;
  }
  return mods.map((m) => {
    const p = prog.find((x) => x.moduleId === m.id);
    const extra = p ? percentFor(m.key, p.stateJson, p.status) : null;
    return {
      id: m.id,
      key: m.key,
      dayNumber: m.dayNumber,
      title: m.title,
      summary: m.summary,
      status: m.status,
      isPreview: m.isPreview,
      estimatedMinutes: m.estimatedMinutes,
      format: m.format,
      origin: m.origin,
      contentStatus: m.contentStatus,
      locked: lockedKeys.has(m.key),
      progress: p
        ? {
            status: p.status,
            percent: extra!.percent,
            stageLabel: extra!.stageLabel,
            bestScore: p.bestScore,
            assessmentAttempts: p.assessmentAttempts,
            updatedAt: p.updatedAt,
            completedAt: p.completedAt,
          }
        : null,
    };
  });
}

export async function getAcademyDays() {
  return db.select().from(schema.academyDays).orderBy(asc(schema.academyDays.dayNumber));
}

export type NextAction =
  | { kind: "start" | "continue" | "remediate"; module: ModuleWithProgress; headline: string; detail: string; cta: string }
  | { kind: "caught-up"; headline: string; detail: string };

export function computeNextAction(mods: ModuleWithProgress[]): NextAction {
  // Titan modules first (the real curriculum), then built-in practice labs.
  const available = mods
    .filter((m) => m.status === "AVAILABLE" && !m.locked)
    .sort((a, b) => (a.origin === b.origin ? 0 : a.origin === "titan-import" ? -1 : 1));
  const remediation = available.find((m) => m.progress?.status === "REMEDIATION");
  if (remediation)
    return {
      kind: "remediate",
      module: remediation,
      headline: "Review what you missed, then retake verification",
      detail: `${remediation.title} — your last verification attempt did not pass. Review the targeted explanations, then try a new set of alerts.`,
      cta: "Start remediation",
    };
  const inProgress = available.find((m) => m.progress?.status === "IN_PROGRESS");
  if (inProgress)
    return {
      kind: "continue",
      module: inProgress,
      headline: `Continue ${inProgress.title}`,
      detail: `You are in the ${inProgress.progress?.stageLabel ?? ""} stage. Your progress is saved — pick up exactly where you left off.`,
      cta: "Continue training",
    };
  const notStarted = available.find((m) => !m.locked && (!m.progress || m.progress.status === "NOT_STARTED"));
  if (notStarted)
    return {
      kind: "start",
      module: notStarted,
      headline: `Start ${notStarted.title}`,
      detail: notStarted.summary,
      cta: "Start training",
    };
  return {
    kind: "caught-up",
    headline: "You’re caught up",
    detail: "You have completed every module available in this build. More Academy modules arrive in upcoming phases.",
  };
}

export async function getCompetencyRecords(userId: string) {
  const comps = await db.select().from(schema.competencies).orderBy(asc(schema.competencies.category), asc(schema.competencies.name));
  const recs = await db.select().from(schema.competencyRecords).where(eq(schema.competencyRecords.userId, userId));
  return comps.map((c) => {
    const r = recs.find((x) => x.competencyId === c.id);
    return { ...c, level: r?.level ?? "NOT_STARTED", note: r?.note ?? null, updatedAt: r?.updatedAt ?? null, validatedAt: r?.validatedAt ?? null };
  });
}

export async function getCompetencyEvents(userId: string, limit = 50) {
  return db
    .select({
      id: schema.competencyEvents.id,
      fromLevel: schema.competencyEvents.fromLevel,
      toLevel: schema.competencyEvents.toLevel,
      reason: schema.competencyEvents.reason,
      createdAt: schema.competencyEvents.createdAt,
      name: schema.competencies.name,
    })
    .from(schema.competencyEvents)
    .innerJoin(schema.competencies, eq(schema.competencies.id, schema.competencyEvents.competencyId))
    .where(eq(schema.competencyEvents.userId, userId))
    .orderBy(desc(schema.competencyEvents.createdAt))
    .limit(limit);
}

export type AttemptRow = Awaited<ReturnType<typeof getAttempts>>[number];

export async function getAttempts(userId: string, limit = 200) {
  const rows = await db
    .select({
      id: schema.trainingAttempts.id,
      stepId: schema.trainingAttempts.stepId,
      itemId: schema.trainingAttempts.itemId,
      stage: schema.trainingAttempts.stage,
      tryNumber: schema.trainingAttempts.tryNumber,
      assessmentAttempt: schema.trainingAttempts.assessmentAttempt,
      responseJson: schema.trainingAttempts.responseJson,
      isCorrect: schema.trainingAttempts.isCorrect,
      isCritical: schema.trainingAttempts.isCritical,
      misconception: schema.trainingAttempts.misconception,
      createdAt: schema.trainingAttempts.createdAt,
      moduleKey: schema.modules.key,
      moduleTitle: schema.modules.title,
    })
    .from(schema.trainingAttempts)
    .innerJoin(schema.modules, eq(schema.modules.id, schema.trainingAttempts.moduleId))
    .where(eq(schema.trainingAttempts.userId, userId))
    .orderBy(desc(schema.trainingAttempts.createdAt))
    .limit(limit);
  return rows.map((r) => describeAttempt(r));
}

/** Turns stored ids into readable text for history and supervisor review. */
function describeAttempt<T extends { moduleKey: string; itemId: string; responseJson: string; misconception: string | null }>(r: T) {
  let response: { action?: string; rule?: string } = {};
  try {
    response = JSON.parse(r.responseJson);
  } catch {}
  const course = getCourseModule(r.moduleKey);
  if (course) {
    const q = course.steps.flatMap((s) => (s.kind === "practice" || s.kind === "mastery" ? s.items : [])).find((i) => i.id === r.itemId);
    return {
      ...r,
      scenarioLabel: `${r.moduleKey} · ${q ? (q.prompt.length > 110 ? q.prompt.slice(0, 107) + "…" : q.prompt) : r.itemId}`,
      actionLabel: response.action ?? "—",
      ruleLabel: "",
      misconceptionLabel: r.misconception === "not-scored" ? "Not scored (pending source decision)" : null,
    };
  }
  const content = getLessonModule(r.moduleKey);
  let scenarioLabel = r.itemId;
  if (content) {
    const items = content.steps.flatMap((s) =>
      s.kind === "decision" ? [s.item] : s.kind === "practice" ? s.items : s.kind === "assessment" ? s.groups.flat() : [],
    );
    const it = items.find((i) => i.id === r.itemId);
    const sc = content.scenarios.find((s) => s.id === it?.scenarioId);
    const site = content.sites.find((s) => s.id === sc?.siteId);
    if (sc && site) scenarioLabel = `${site.siteCode} · ${sc.cameraId} · ${sc.eventType} · ${sc.day} ${sc.alertTime.slice(0, 5)}`;
  }
  return {
    ...r,
    scenarioLabel,
    actionLabel: content?.actions.find((a) => a.id === response.action)?.label ?? response.action ?? "—",
    ruleLabel: response.rule ?? "—",
    misconceptionLabel: content?.misconceptions.find((m) => m.key === r.misconception)?.label ?? null,
  };
}

/** Trainees a supervisor may see: assigned ones, or everyone with the view_all permission. */
export async function getVisibleTrainees(supervisorId: string, viewAll: boolean) {
  const operatorRole = await db.query.roles.findFirst({ where: eq(schema.roles.key, "OPERATOR") });
  if (!operatorRole) return [];
  const operatorIds = (await db.select({ id: schema.userRoles.userId }).from(schema.userRoles).where(eq(schema.userRoles.roleId, operatorRole.id))).map((r) => r.id);
  let ids = operatorIds;
  if (!viewAll) {
    const assigned = await db.select({ id: schema.supervisorAssignments.traineeId }).from(schema.supervisorAssignments).where(eq(schema.supervisorAssignments.supervisorId, supervisorId));
    const set = new Set(assigned.map((a) => a.id));
    ids = operatorIds.filter((id) => set.has(id));
  }
  if (!ids.length) return [];
  return db.select().from(schema.users).where(and(inArray(schema.users.id, ids), eq(schema.users.active, true))).orderBy(asc(schema.users.displayName));
}

export async function canSupervisorSee(supervisorId: string, traineeId: string, viewAll: boolean) {
  const list = await getVisibleTrainees(supervisorId, viewAll);
  return list.some((t) => t.id === traineeId);
}

export async function getNotes(traineeId: string) {
  return db
    .select({
      id: schema.supervisorNotes.id,
      category: schema.supervisorNotes.category,
      body: schema.supervisorNotes.body,
      moduleKey: schema.supervisorNotes.moduleKey,
      createdAt: schema.supervisorNotes.createdAt,
      author: schema.users.displayName,
    })
    .from(schema.supervisorNotes)
    .innerJoin(schema.users, eq(schema.users.id, schema.supervisorNotes.authorId))
    .where(eq(schema.supervisorNotes.traineeId, traineeId))
    .orderBy(desc(schema.supervisorNotes.createdAt));
}

export function formatDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

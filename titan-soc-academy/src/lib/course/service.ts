import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getCourseModule, getTitanCatalog } from "@/content/titan-catalog";
import { getModulesWithProgress } from "@/lib/academy/queries";
import * as engine from "./engine";
import type { CourseModule, CourseState, Ruling } from "./types";
import { buildCourseView } from "./view";

export async function loadCourse(userId: string, key: string, previewAll: boolean) {
  const content = getCourseModule(key);
  const row = await db.query.modules.findFirst({ where: eq(schema.modules.key, key) });
  if (!content || !row || row.status !== "AVAILABLE") return null;
  const mods = await getModulesWithProgress(userId, { previewAll });
  if (mods.find((m) => m.key === key)?.locked) return { locked: true as const };
  const progress = await db.query.moduleProgress.findFirst({
    where: and(eq(schema.moduleProgress.userId, userId), eq(schema.moduleProgress.moduleId, row.id)),
  });
  return { locked: false as const, content, row, state: progress ? engine.parseCourseState(progress.stateJson) : engine.initialCourseState() };
}

/** Current owner ruling per conflict (newest decision wins). */
export async function getRulings(): Promise<Map<string, Ruling>> {
  const rows = await db
    .select({
      conflictId: schema.contentDecisions.conflictId,
      choice: schema.contentDecisions.choice,
      ruling: schema.contentDecisions.ruling,
      createdAt: schema.contentDecisions.createdAt,
      by: schema.users.displayName,
    })
    .from(schema.contentDecisions)
    .innerJoin(schema.users, eq(schema.users.id, schema.contentDecisions.decidedById))
    .orderBy(asc(schema.contentDecisions.createdAt));
  const map = new Map<string, Ruling>();
  for (const r of rows) map.set(r.conflictId, { conflictId: r.conflictId, choice: r.choice, ruling: r.ruling, decidedAt: r.createdAt.getTime(), decidedBy: r.by });
  return map;
}

export async function courseViewFor(content: CourseModule, state: CourseState) {
  const cat = getTitanCatalog();
  return buildCourseView(content, state, {
    sources: cat?.sources ?? [],
    approvedMedia: new Set((cat?.media ?? []).filter((m) => m.approved).map((m) => m.filename)),
    rulings: await getRulings(),
  });
}


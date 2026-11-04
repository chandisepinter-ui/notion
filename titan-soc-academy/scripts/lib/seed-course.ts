/**
 * Loads an imported Titan course catalog into the database:
 *  - one module row per course module (AVAILABLE, format "course")
 *  - one competency per module (its CompetencyTarget)
 *  - the Day 7 practical skills as the Skill Catalog
 *  - removes built-in "Not yet available" placeholders that real modules replace
 *    (only when nobody has progress on them)
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq, notInArray } from "drizzle-orm";
import * as schema from "../../src/lib/db/schema";
import type { CourseCatalog } from "../../src/lib/course/types";

/** Skill Catalog category → Academy day whose first module is the LEARN path (navigation only). */
const CATEGORY_DAY: Record<string, number> = {
  IMMIX: 2, CAD: 3, TrackTik: 3, HubSpot: 3, Phones: 4, "Email / Teams": 4, ATMs: 5, Radio: 6,
  "Disaster Preparedness": 1, "Call List / Policies & Procedures": 1,
};
const CATEGORY_GAME: Record<string, string> = { IMMIX: "alarm-desk", Radio: "radio-rush" };

export async function seedCourseCatalog(catalog: CourseCatalog) {
  const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/titan-academy.db" });
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client, { schema });

  // Modules set aside by owner decision (e.g. Day 7 live shift) are removed if nobody started them.
  for (const r of catalog.retired ?? []) {
    const row = await db.query.modules.findFirst({ where: eq(schema.modules.key, r.key) });
    if (!row) continue;
    const used = await db.query.moduleProgress.findFirst({ where: eq(schema.moduleProgress.moduleId, row.id) });
    if (used) await db.update(schema.modules).set({ status: "PLANNED", summary: r.reason }).where(eq(schema.modules.id, row.id));
    else await db.delete(schema.modules).where(eq(schema.modules.id, row.id));
  }

  for (const m of catalog.modules) {
    const values = {
      key: m.key,
      dayNumber: m.dayNumber,
      title: m.title,
      summary: m.competencyTarget,
      status: "AVAILABLE",
      isPreview: false,
      estimatedMinutes: null,
      sortOrder: m.sortOrder,
      contentVersion: 1,
      format: "course",
      origin: "titan-import",
      contentStatus: m.contentStatus,
    };
    await db.insert(schema.modules).values(values).onConflictDoUpdate({ target: schema.modules.key, set: values });
    const row = (await db.query.modules.findFirst({ where: eq(schema.modules.key, m.key) }))!;
    const comp = { key: m.key, name: m.title, description: m.competencyTarget, category: m.dayTitle };
    const [c] = await db.insert(schema.competencies).values(comp).onConflictDoUpdate({ target: schema.competencies.key, set: comp }).returning();
    await db.insert(schema.moduleCompetencies).values({ moduleId: row.id, competencyId: c.id }).onConflictDoNothing();
  }

  // Retire built-in placeholders (PLANNED) that imported modules replace and nobody has progress on.
  // Days without imported modules (Day 7: simulated shift) keep their placeholder.
  const importedDays = new Set(catalog.modules.map((m) => m.dayNumber));
  const placeholders = await db.select().from(schema.modules).where(and(eq(schema.modules.origin, "builtin"), eq(schema.modules.status, "PLANNED")));
  for (const p of placeholders.filter((x) => importedDays.has(x.dayNumber))) {
    const used = await db.query.moduleProgress.findFirst({ where: eq(schema.moduleProgress.moduleId, p.id) });
    if (!used) await db.delete(schema.modules).where(eq(schema.modules.id, p.id));
  }

  // Skill Catalog = Day 7 practical skills (Skills Training Checklist).
  if (catalog.day7Skills.length) {
    const firstModuleOfDay = (d: number) =>
      catalog.modules.filter((m) => m.dayNumber === d).sort((a, b) => a.sortOrder - b.sortOrder)[0]?.key ?? null;
    for (const s of catalog.day7Skills) {
      const day = CATEGORY_DAY[s.category];
      const v = {
        key: s.id,
        name: s.name,
        category: s.category,
        description: s.critical ? "Critical skill — rated by your supervisor on Day 7." : "Rated by your supervisor on Day 7.",
        learnModuleKey: day ? firstModuleOfDay(day) : null,
        gameKey: CATEGORY_GAME[s.category] ?? null,
        sortOrder: s.sortOrder,
      };
      await db.insert(schema.skills).values(v).onConflictDoUpdate({ target: schema.skills.key, set: v });
    }
    await db.delete(schema.skills).where(notInArray(schema.skills.key, catalog.day7Skills.map((s) => s.id)));
  }
  client.close();
}

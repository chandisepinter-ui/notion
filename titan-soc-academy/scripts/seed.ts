/**
 * Seeds the database with the curriculum registry, roles, permissions and
 * FICTIONAL demonstration accounts. Safe to run repeatedly:
 *  - curriculum (days, modules, competencies, skills, games) is refreshed from code;
 *  - roles/permission grants and users are only created if missing, so changes
 *    made through the admin screens are not overwritten.
 * No training progress is seeded: every number in the app comes from real use.
 */
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from "../src/lib/auth/permissions";
import { readFileSync } from "node:fs";
import { seedCourseCatalog } from "./lib/seed-course";
import type { CourseCatalog } from "../src/lib/course/types";
import { ACADEMY_DAYS, ARCADE_SEEDS, DEMO_USERS, LESSON_MODULES, MODULE_SEEDS, SKILL_SEEDS } from "../src/content/curriculum";

if (existsSync(".env")) loadEnvFile(".env");

async function main() {
  const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/titan-academy.db" });
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client, { schema });

  // Permissions (descriptions refreshed from code)
  const existingPerms = new Set((await db.select().from(schema.permissions)).map((p) => p.key));
  for (const p of PERMISSION_DEFINITIONS) {
    await db.insert(schema.permissions).values(p).onConflictDoUpdate({ target: schema.permissions.key, set: { category: p.category, description: p.description } });
  }

  // Roles — grants only written when the role is first created
  for (const r of ROLE_DEFINITIONS) {
    const existing = await db.query.roles.findFirst({ where: eq(schema.roles.key, r.key) });
    if (existing) {
      await db.update(schema.roles).set({ name: r.name, description: r.description, rank: r.rank }).where(eq(schema.roles.id, existing.id));
      continue;
    }
    const [role] = await db.insert(schema.roles).values({ key: r.key, name: r.name, description: r.description, rank: r.rank }).returning();
    await db.insert(schema.rolePermissions).values(r.permissions.map((permissionKey) => ({ roleId: role.id, permissionKey })));
  }

  // A permission added in a newer version is granted to its default roles once,
  // without touching any grants an administrator has changed.
  for (const p of PERMISSION_DEFINITIONS.filter((p) => existingPerms.size && !existingPerms.has(p.key))) {
    for (const r of ROLE_DEFINITIONS.filter((r) => r.permissions.includes(p.key))) {
      const role = await db.query.roles.findFirst({ where: eq(schema.roles.key, r.key) });
      if (role) await db.insert(schema.rolePermissions).values({ roleId: role.id, permissionKey: p.key }).onConflictDoNothing();
    }
  }

  // Academy days & modules
  for (const d of ACADEMY_DAYS) {
    await db.insert(schema.academyDays).values({ ...d }).onConflictDoUpdate({ target: schema.academyDays.dayNumber, set: { title: d.title, summary: d.summary, format: d.format } });
  }
  for (const m of MODULE_SEEDS) {
    const content = LESSON_MODULES[m.key];
    const values = { ...m, contentVersion: content?.version ?? 1 };
    await db.insert(schema.modules).values(values).onConflictDoUpdate({ target: schema.modules.key, set: values });
  }

  // Competencies (from module content)
  for (const content of Object.values(LESSON_MODULES)) {
    const mod = await db.query.modules.findFirst({ where: eq(schema.modules.key, content.key) });
    for (const c of content.competencies) {
      const [row] = await db
        .insert(schema.competencies)
        .values(c)
        .onConflictDoUpdate({ target: schema.competencies.key, set: { name: c.name, description: c.description, category: c.category } })
        .returning();
      if (mod) await db.insert(schema.moduleCompetencies).values({ moduleId: mod.id, competencyId: row.id }).onConflictDoNothing();
    }
  }

  for (const s of SKILL_SEEDS) {
    await db.insert(schema.skills).values(s).onConflictDoUpdate({ target: schema.skills.key, set: s });
  }
  for (const g of ARCADE_SEEDS) {
    await db.insert(schema.arcadeGames).values(g).onConflictDoUpdate({ target: schema.arcadeGames.key, set: g });
  }

  // Demonstration users (fictional)
  const ids: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    let user = await db.query.users.findFirst({ where: eq(schema.users.email, u.email) });
    if (!user) {
      [user] = await db
        .insert(schema.users)
        .values({ displayName: u.displayName, email: u.email, title: u.title, shift: u.shift, isDemo: true })
        .returning();
      for (const roleKey of u.roles) {
        const role = await db.query.roles.findFirst({ where: eq(schema.roles.key, roleKey) });
        if (role) await db.insert(schema.userRoles).values({ userId: user.id, roleId: role.id }).onConflictDoNothing();
      }
    }
    ids[u.key] = user.id;
  }

  // Supervisor Morgan Ellis is assigned Jordan Reyes only (Riley Chen sees all via permission).
  const exists = await db.query.supervisorAssignments.findFirst({
    where: and(eq(schema.supervisorAssignments.supervisorId, ids.supervisor), eq(schema.supervisorAssignments.traineeId, ids.operator)),
  });
  if (!exists) await db.insert(schema.supervisorAssignments).values({ supervisorId: ids.supervisor, traineeId: ids.operator });

  // Imported Titan content (git-ignored) replaces the placeholders if present.
  const catalogPath = "content-import/generated/titan-catalog.json";
  if (existsSync(catalogPath) && process.env.TITAN_CONTENT !== "off") {
    await seedCourseCatalog(JSON.parse(readFileSync(catalogPath, "utf8")) as CourseCatalog);
    console.log("✔ Imported Titan curriculum loaded from content-import/.");
  } else {
    console.log("ℹ No imported Titan content found (content-import/). Showing placeholders. See README → Importing Titan content.");
  }

  console.log("✔ Seed complete: roles, permissions, curriculum, skills, arcade and demo accounts are ready.");
  client.close();
}

main().catch((e) => {
  console.error("✖ Seed failed:", e);
  process.exit(1);
});

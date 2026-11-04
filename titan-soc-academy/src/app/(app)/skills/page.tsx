import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { BookOpen, Gamepad2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlannedBadge } from "@/components/ui/Planned";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Skill Catalog" };

export default async function SkillsPage() {
  await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const [skills, games, modules] = await Promise.all([
    db.select().from(schema.skills).orderBy(asc(schema.skills.sortOrder)),
    db.select().from(schema.arcadeGames),
    db.select().from(schema.modules),
  ]);
  const categories = [...new Set(skills.map((s) => s.category))];
  return (
    <>
      <PageHeader eyebrow="Every operational skill" title="Skill Catalog" description="Each skill has two paths: LEARN through guided instruction, and PLAY through games that build the same skill. Paths that are not built yet are clearly marked." />
      <div className="grid gap-8">
        {categories.map((cat) => (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="titan-eyebrow mb-3">{cat}</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {skills.filter((s) => s.category === cat).map((s) => {
                const mod = modules.find((m) => m.key === s.learnModuleKey);
                const learnReady = mod?.status === "AVAILABLE";
                const game = games.find((g) => g.key === s.gameKey);
                return (
                  <li key={s.key} className="titan-panel flex flex-col gap-4 p-5">
                    <div>
                      <p className="font-semibold text-fg">{s.name}</p>
                      <p className="mt-1 text-sm text-fg-muted">{s.description}</p>
                    </div>
                    <div className="mt-auto grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-line p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle"><BookOpen aria-hidden className="size-3.5" /> Learn</p>
                        {learnReady ? (
                          <Link href={`/academy/${mod!.key}`} className="mt-1.5 block text-sm font-medium text-accent-strong hover:underline">{mod!.title}</Link>
                        ) : (
                          <div className="mt-1.5"><PlannedBadge /></div>
                        )}
                      </div>
                      <div className="rounded-xl border border-line p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle"><Gamepad2 aria-hidden className="size-3.5" /> Play</p>
                        {game ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <Link href="/arcade" className="text-sm font-medium text-fg hover:underline">{game.name}</Link>
                            {game.status !== "AVAILABLE" && <PlannedBadge phase={game.plannedPhase ?? undefined} />}
                          </div>
                        ) : (
                          <div className="mt-1.5"><Badge tone="planned">No game defined yet</Badge></div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

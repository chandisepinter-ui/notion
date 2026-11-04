import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { Gamepad2, Lock, Trophy } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState, PlannedBadge } from "@/components/ui/Planned";

export const metadata: Metadata = { title: "Arcade" };

const RULES = [
  "Practice mode is open to everyone.",
  "Test mode unlocks after you pass the related Academy module.",
  "Only eligible Test results count toward leaderboards.",
  "Accuracy matters more than speed. No timers, no speed penalties.",
  "Missed concepts are tracked for future reinforcement.",
  "Days, Swings and Nights team standings will be normalized by active participants.",
];

export default async function ArcadePage() {
  await requirePermission(PERMISSIONS.ARCADE_PLAY);
  const [games, modules] = await Promise.all([db.select().from(schema.arcadeGames).orderBy(asc(schema.arcadeGames.sortOrder)), db.select().from(schema.modules)]);
  return (
    <>
      <PageHeader eyebrow="For low-volume periods" title="Arcade" description="Games that build real job skills through puzzles and simulated work — never at the expense of live duties." />
      <div className="grid grid-cols-1 gap-6">
        <ul className="grid gap-4 lg:grid-cols-3">
          {games.map((g) => {
            const unlock = modules.find((m) => m.key === g.unlockModuleKey);
            return (
              <li key={g.key} className="titan-panel flex flex-col overflow-hidden">
                <div className="relative grid h-32 place-items-center border-b border-line bg-[radial-gradient(400px_140px_at_50%_120%,var(--accent-soft),transparent)]">
                  <Gamepad2 aria-hidden className="size-10 text-fg-subtle" />
                  <span className="absolute right-3 top-3"><PlannedBadge phase={g.plannedPhase ?? undefined} /></span>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <h2 className="text-lg font-semibold text-fg">{g.name}</h2>
                    <p className="text-sm font-medium text-fg-muted">{g.tagline}</p>
                  </div>
                  <p className="text-sm text-fg-muted">{g.description}</p>
                  <p className="mt-auto flex items-center gap-2 text-xs text-fg-subtle">
                    <Lock aria-hidden className="size-3.5" />
                    Test mode unlock: {unlock ? `pass “${unlock.title}”` : "to be defined with the approved template"}
                  </p>
                  <p className="rounded-xl border border-dashed border-line-strong px-3 py-2 text-center text-sm text-fg-subtle">This game is not built yet</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="How the Arcade will work" eyebrow="Design rules" />
            <ul className="grid gap-2 p-6 text-sm text-fg-muted">
              {RULES.map((r) => <li key={r} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />{r}</li>)}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader title="Leaderboards & daily challenges" eyebrow="Competition" actions={<PlannedBadge phase={4} />} />
            <EmptyState icon={<Trophy className="size-5" />} title="No results yet">Leaderboards activate when the first game launches in Test mode. No placeholder scores are shown.</EmptyState>
          </Panel>
        </div>
      </div>
    </>
  );
}

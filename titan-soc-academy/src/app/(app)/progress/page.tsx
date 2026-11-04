import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatDateTime, getCompetencyEvents, getCompetencyRecords, getModulesWithProgress } from "@/lib/academy/queries";
import { COMPETENCY_LEVELS, type CompetencyLevel } from "@/lib/academy/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { CompetencyBadge, CompetencyMeter } from "@/components/ui/CompetencyBadge";
import { EmptyState } from "@/components/ui/Planned";
import { ProgressBar } from "@/components/ui/Progress";
import { moduleStatusBadge } from "@/components/academy/AcademyRoadmap";

export const metadata: Metadata = { title: "Progress & Competency" };

export default async function ProgressPage() {
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const [comps, events, mods] = await Promise.all([getCompetencyRecords(user.id), getCompetencyEvents(user.id), getModulesWithProgress(user.id, { previewAll: user.permissions.has(PERMISSIONS.ACADEMY_PREVIEW_ALL) })]);
  const ladder = (["LEARNING", "ASSISTED", "PRACTICING", "MASTERY_DEMONSTRATED", "REMEDIATION"] as CompetencyLevel[]).map((k) => ({ key: k, ...COMPETENCY_LEVELS[k] }));
  const started = mods.filter((m) => m.progress);
  return (
    <>
      <PageHeader eyebrow="Measured, not assumed" title="Progress & Competency" description="Finishing a lesson is not the same as mastering a skill. Each competency moves up only when you demonstrate it, and drops to remediation if verification shows a gap." />
      <div className="grid grid-cols-1 gap-6">
        <Panel aria-labelledby="ladder">
          <PanelHeader title="How competency is measured" id="ladder" eyebrow="The ladder" />
          <ol className="grid gap-3 p-6 sm:grid-cols-5">
            {ladder.map((l) => (
              <li key={l.key} className="rounded-xl border border-line bg-surface-2/60 p-4">
                <CompetencyBadge level={l.key} />
                <p className="mt-2 text-sm text-fg-muted">{l.description}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel aria-labelledby="comps">
          <PanelHeader title="My competencies" id="comps" eyebrow={`${comps.length} tracked`} />
          <ul className="divide-y divide-line px-6 py-2">
            {comps.map((c) => (
              <li key={c.id} className="grid gap-3 py-4 md:grid-cols-[1.4fr_auto_1fr] md:items-center">
                <div>
                  <p className="font-medium text-fg">{c.name} <span className="ml-1 font-mono text-xs text-fg-subtle">{c.category}</span></p>
                  <p className="text-sm text-fg-muted">{c.description}</p>
                </div>
                <div className="flex items-center gap-3"><CompetencyMeter level={c.level} /><CompetencyBadge level={c.level} /></div>
                <div className="text-sm text-fg-subtle md:text-right">
                  {c.note ?? "No evidence yet."}
                  {c.updatedAt && <span className="block font-mono text-xs">{formatDateTime(c.updatedAt)}</span>}
                  <span className="block text-xs">{c.validatedAt ? "Supervisor validated" : "Supervisor validation: pending (Day 7)"}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel aria-labelledby="mods">
            <PanelHeader title="Module progress" id="mods" />
            {started.length === 0 ? (
              <EmptyState title="No modules started yet">Start the IMMIX demonstration module from your dashboard.</EmptyState>
            ) : (
              <ul className="grid gap-4 p-6">
                {started.map((m) => (
                  <li key={m.id} className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-fg">{m.title}</p>
                      {moduleStatusBadge(m)}
                    </div>
                    <ProgressBar value={m.progress!.percent} label={`${m.title} progress`} tone={m.progress!.status === "PASSED" ? "success" : "accent"} />
                    <p className="text-xs text-fg-subtle">
                      {m.progress!.percent}% of steps complete · Verification attempts: {m.progress!.assessmentAttempts}
                      {m.progress!.bestScore !== null ? ` · Best score ${m.progress!.bestScore}%` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel aria-labelledby="timeline">
            <PanelHeader title="Competency timeline" id="timeline" eyebrow="Audit trail" />
            {events.length === 0 ? (
              <EmptyState title="No changes recorded yet" />
            ) : (
              <ol className="grid gap-3 p-6">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                    <div>
                      <p className="text-fg"><strong>{e.name}</strong>: {COMPETENCY_LEVELS[e.fromLevel as CompetencyLevel]?.label} → {COMPETENCY_LEVELS[e.toLevel as CompetencyLevel]?.label}</p>
                      <p className="text-fg-subtle">{e.reason} · <span className="font-mono">{formatDateTime(e.createdAt)}</span></p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

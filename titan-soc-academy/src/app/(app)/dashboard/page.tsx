import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDot, Sparkles, XCircle } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { computeNextAction, formatDateTime, getAcademyDays, getAttempts, getCompetencyRecords, getModulesWithProgress } from "@/lib/academy/queries";
import { ButtonLink } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { CompetencyBadge, CompetencyMeter } from "@/components/ui/CompetencyBadge";
import { ProgressRing } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/Planned";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const [mods, days, comps, attempts] = await Promise.all([
    getModulesWithProgress(user.id),
    getAcademyDays(),
    getCompetencyRecords(user.id),
    getAttempts(user.id, 6),
  ]);
  const next = computeNextAction(mods);
  const total = mods.length;
  const passed = mods.filter((m) => m.progress?.status === "PASSED").length;
  const available = mods.filter((m) => m.status === "AVAILABLE").length;
  const firstName = user.displayName.split(" ")[0];
  const started = comps.filter((c) => c.level !== "NOT_STARTED");

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <p className="titan-eyebrow">Operator dashboard</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.025em] text-fg sm:text-[2rem]">Welcome, {firstName}.</h1>
      </div>

      {/* The single most important thing: what to do next */}
      <Panel edge className="overflow-hidden" aria-labelledby="next-step">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_220px_at_90%_0%,var(--accent-soft),transparent)]" aria-hidden />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="titan-eyebrow flex items-center gap-2 text-accent-strong">
              <span className="animate-live size-1.5 rounded-full bg-accent" aria-hidden /> Your next step
            </p>
            <h2 id="next-step" className="mt-3 text-2xl font-semibold leading-snug tracking-[-0.02em] text-fg sm:text-[1.75rem]">
              {next.headline}
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-fg-muted">{next.detail}</p>
          </div>
          {next.kind !== "caught-up" ? (
            <ButtonLink href={`/academy/${next.module.key}`} size="xl" className="w-full lg:w-auto">
              {next.cta} <ArrowRight aria-hidden className="size-5" />
            </ButtonLink>
          ) : (
            <ButtonLink href="/progress" variant="secondary" size="lg">View my competencies</ButtonLink>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Academy progress */}
        <Panel aria-labelledby="academy-progress">
          <PanelHeader eyebrow="Seven-day Initial Academy" title="Academy progress" id="academy-progress" actions={<Link href="/academy" className="text-sm font-medium text-accent-strong hover:underline">Full roadmap</Link>} />
          <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <ProgressRing value={total ? (passed / total) * 100 : 0} size={112} stroke={8} label="Academy modules verified">
              <div>
                <p className="text-2xl font-semibold text-fg">{passed}<span className="text-base text-fg-subtle">/{total}</span></p>
                <p className="text-[0.6875rem] text-fg-subtle">verified</p>
              </div>
            </ProgressRing>
            <ol className="grid grid-cols-7 gap-1.5" aria-label="Academy days">
              {days.map((d) => {
                const dm = mods.filter((m) => m.dayNumber === d.dayNumber);
                const done = dm.length > 0 && dm.every((m) => m.progress?.status === "PASSED");
                const active = dm.some((m) => m.progress && m.progress.status !== "PASSED");
                const open = dm.some((m) => m.status === "AVAILABLE");
                return (
                  <li key={d.dayNumber} className="flex flex-col items-center gap-2" title={`Day ${d.dayNumber}: ${d.title}`}>
                    <span className={cn("h-16 w-full rounded-lg border", done ? "border-success/40 bg-success-soft" : active ? "border-accent-line bg-accent-soft" : open ? "border-line-strong bg-surface-2" : "border-dashed border-line bg-transparent")} aria-hidden />
                    <span className="font-mono text-[0.6875rem] text-fg-subtle">D{d.dayNumber}</span>
                    <span className="sr-only">Day {d.dayNumber} {d.title}: {done ? "verified" : active ? "in progress" : open ? "available" : "not yet available"}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="border-t border-line px-6 py-3 text-xs text-fg-subtle">
            {available} of {total} modules are available in this build. Others are marked “Not yet available.”
          </p>
        </Panel>

        {/* Competencies */}
        <Panel aria-labelledby="comp-snapshot">
          <PanelHeader eyebrow="Measured by the platform" title="Competencies" id="comp-snapshot" actions={<Link href="/progress" className="text-sm font-medium text-accent-strong hover:underline">Details</Link>} />
          {started.length === 0 ? (
            <EmptyState icon={<Sparkles className="size-5" />} title="No competency evidence yet">
              Competencies are recorded as you complete training activities.
            </EmptyState>
          ) : (
            <ul className="grid gap-1 p-4">
              {comps.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-xl px-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-fg">{c.name}</p>
                    <div className="mt-1.5"><CompetencyMeter level={c.level} /></div>
                  </div>
                  <CompetencyBadge level={c.level} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Recent activity */}
      <Panel aria-labelledby="recent">
        <PanelHeader eyebrow="Your answers" title="Recent activity" id="recent" actions={<Link href="/history" className="text-sm font-medium text-accent-strong hover:underline">All history</Link>} />
        {attempts.length === 0 ? (
          <EmptyState icon={<CircleDot className="size-5" />} title="No answers recorded yet">Your graded decisions will appear here.</EmptyState>
        ) : (
          <ul className="divide-y divide-line px-6 pb-2 pt-3">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-3">
                {a.isCorrect ? <CheckCircle2 aria-label="Correct" className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle aria-label="Incorrect" className="mt-0.5 size-5 shrink-0 text-danger" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{a.scenarioLabel}</p>
                  <p className="text-xs text-fg-subtle">
                    {a.stage.toUpperCase()} · {a.actionLabel} · {a.ruleLabel}
                    {a.misconceptionLabel ? ` · ${a.misconceptionLabel}` : ""}
                  </p>
                </div>
                <time className="shrink-0 font-mono text-xs text-fg-subtle">{formatDateTime(a.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

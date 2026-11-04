import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, Lock, PlayCircle, RotateCcw } from "lucide-react";
import type { ModuleWithProgress } from "@/lib/academy/queries";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { cn } from "@/lib/cn";
import { ContentStatusBadge } from "@/components/course/ContentStatus";

type Day = { dayNumber: number; title: string; summary: string; format: string };

export function moduleStatusBadge(m: ModuleWithProgress) {
  if (m.status !== "AVAILABLE")
    return (
      <Badge tone="planned">
        <Clock3 aria-hidden className="size-3" /> Not yet available
      </Badge>
    );
  if (m.locked)
    return (
      <Badge tone="neutral"><Lock aria-hidden className="size-3" /> Locked</Badge>
    );
  switch (m.progress?.status) {
    case "PENDING_SOURCE":
      return <Badge tone="warning">Completed · pending source</Badge>;
    case "PASSED":
      return <Badge tone="success"><CheckCircle2 aria-hidden className="size-3" /> Verified</Badge>;
    case "REMEDIATION":
      return <Badge tone="danger"><RotateCcw aria-hidden className="size-3" /> Remediation required</Badge>;
    case "IN_PROGRESS":
      return <Badge tone="accent"><PlayCircle aria-hidden className="size-3" /> In progress · {m.progress.stageLabel}</Badge>;
    default:
      return <Badge tone="neutral">Ready to start</Badge>;
  }
}

/** Full seven-day roadmap. Unbuilt modules are clearly marked, never clickable. */
export function AcademyRoadmap({ days, modules }: { days: Day[]; modules: ModuleWithProgress[] }) {
  return (
    <ol className="relative grid gap-4">
      {days.map((day) => {
        const mods = modules.filter((m) => m.dayNumber === day.dayNumber);
        const anyAvailable = mods.some((m) => m.status === "AVAILABLE" && !m.locked);
        const allPassed = mods.length > 0 && mods.every((m) => m.progress?.status === "PASSED");
        return (
          <li key={day.dayNumber} className="titan-panel grid gap-5 p-5 sm:grid-cols-[180px_1fr] sm:p-6">
            <div className="flex items-start gap-4 sm:block">
              <div
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-2xl border font-mono text-lg font-semibold",
                  allPassed ? "border-success/40 bg-success-soft text-success" : anyAvailable ? "border-accent-line bg-accent-soft text-accent-strong" : "border-line bg-surface-2 text-fg-subtle",
                )}
                aria-hidden
              >
                {String(day.dayNumber).padStart(2, "0")}
              </div>
              <div className="sm:mt-3">
                <p className="titan-eyebrow">Day {day.dayNumber}</p>
                <h3 className="mt-1 text-base font-semibold text-fg">{day.title}</h3>
                <p className="mt-1 text-xs text-fg-subtle">{day.format}</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-fg-muted">{day.summary}</p>
              <ul className="mt-4 grid gap-2">
                {mods.map((m) => {
                  const available = m.status === "AVAILABLE" && !m.locked;
                  const inner = (
                    <>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("font-medium", available ? "text-fg" : "text-fg-subtle")}>{m.title}</span>
                          {m.origin === "titan-import" && <span className="font-mono text-[0.6875rem] text-fg-subtle">{m.key}</span>}
                          {m.isPreview && available && <Badge tone="accent">Practice lab · fictional</Badge>}
                          {m.contentStatus && <ContentStatusBadge status={m.contentStatus} />}
                        </div>
                        {available && m.progress && m.progress.status !== "PASSED" && (
                          <ProgressBar value={m.progress.percent} label={`${m.title} progress`} className="max-w-xs" />
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {moduleStatusBadge(m)}
                        {available ? <ArrowUpRight aria-hidden className="size-4 text-fg-subtle" /> : m.locked ? null : <Lock aria-hidden className="size-4 text-fg-subtle" />}
                      </div>
                    </>
                  );
                  return (
                    <li key={m.key}>
                      {available ? (
                        <Link href={`/academy/${m.key}`} className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/60 px-4 py-3 transition hover:border-accent-line hover:bg-surface-2 sm:flex-row sm:items-center">
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line px-4 py-3 sm:flex-row sm:items-center" aria-disabled="true">
                          {inner}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

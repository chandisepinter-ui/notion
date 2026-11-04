import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronLeft, NotebookPen } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { canSupervisorSee, formatDateTime, getAttempts, getCompetencyRecords, getModulesWithProgress, getNotes } from "@/lib/academy/queries";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState, PlannedFeature } from "@/components/ui/Planned";
import { Badge } from "@/components/ui/Badge";
import { CompetencyBadge, CompetencyMeter } from "@/components/ui/CompetencyBadge";
import { AttemptTable } from "@/components/academy/AttemptTable";
import { NoteForm } from "@/components/academy/NoteForm";
import { moduleStatusBadge } from "@/components/academy/AcademyRoadmap";

export const metadata: Metadata = { title: "Trainee review" };

export default async function TraineePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.SUPERVISOR_TRAINEES_VIEW);
  const viewAll = user.permissions.has(PERMISSIONS.SUPERVISOR_TRAINEES_VIEW_ALL);
  if (!(await canSupervisorSee(user.id, id, viewAll))) notFound();
  const trainee = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!trainee) notFound();
  const [mods, comps, attempts, notes] = await Promise.all([getModulesWithProgress(id), getCompetencyRecords(id), getAttempts(id), getNotes(id)]);
  const available = mods.filter((m) => m.status === "AVAILABLE");
  const canWrite = user.permissions.has(PERMISSIONS.SUPERVISOR_NOTES_WRITE);
  const wrong = attempts.filter((a) => !a.isCorrect);
  const concepts = Object.entries(wrong.reduce<Record<string, number>>((acc, a) => { if (a.misconceptionLabel) acc[a.misconceptionLabel] = (acc[a.misconceptionLabel] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/supervisor" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"><ChevronLeft aria-hidden className="size-4" /> All trainees</Link>
      <header>
        <p className="titan-eyebrow">Trainee review</p>
        <h1 className="mt-2 flex flex-wrap items-center gap-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-fg">{trainee.displayName} {trainee.isDemo && <Badge>Demo account</Badge>}</h1>
        <p className="mt-1 text-fg-muted">{trainee.title} · {trainee.shift ?? "No shift"} · {trainee.email}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel aria-labelledby="mod-h">
          <PanelHeader title="Modules" id="mod-h" />
          <ul className="grid gap-3 p-6">
            {available.map((m) => (
              <li key={m.key} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-fg">{m.title}</p>{moduleStatusBadge(m)}</div>
                <p className="mt-2 text-sm text-fg-subtle">
                  {m.progress ? `${m.progress.percent}% of steps · ${m.progress.assessmentAttempts} verification attempt(s)${m.progress.bestScore !== null ? ` · best ${m.progress.bestScore}%` : ""} · updated ${formatDateTime(m.progress.updatedAt)}` : "Not started"}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel aria-labelledby="comp-h">
          <PanelHeader title="Competencies" id="comp-h" eyebrow="System-measured" />
          <ul className="grid gap-1 p-4">
            {comps.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 rounded-xl px-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-medium text-fg">{c.name}</p><p className="text-xs text-fg-subtle">{c.note ?? "No evidence yet."}</p><div className="mt-1.5"><CompetencyMeter level={c.level} /></div></div>
                <CompetencyBadge level={c.level} />
              </li>
            ))}
          </ul>
          <div className="px-6 pb-6"><PlannedFeature title="Supervisor validation of competencies" phase={3}>Validate or override system-measured levels during the Day 7 review.</PlannedFeature></div>
        </Panel>
      </div>

      <Panel aria-labelledby="concept-h">
        <PanelHeader title="Recurring mistakes" id="concept-h" eyebrow="From graded answers" />
        {concepts.length === 0 ? (
          <EmptyState title="No incorrect answers recorded" />
        ) : (
          <ul className="flex flex-wrap gap-2 p-6">{concepts.map(([label, n]) => <li key={label}><Badge tone={n > 1 ? "danger" : "warning"}>{label} × {n}</Badge></li>)}</ul>
        )}
      </Panel>

      <Panel aria-labelledby="ans-h">
        <PanelHeader title="Answer review" id="ans-h" eyebrow={`${attempts.length} graded answers`} />
        {attempts.length === 0 ? <EmptyState title="No answers yet" /> : <AttemptTable attempts={attempts} caption={`Graded answers for ${trainee.displayName}`} />}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="notes-h">
          <PanelHeader title="Supervisor notes" id="notes-h" eyebrow="Remediation & coaching record" />
          {notes.length === 0 ? (
            <EmptyState icon={<NotebookPen className="size-5" />} title="No notes yet" />
          ) : (
            <ol className="grid gap-3 p-6">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                    <Badge tone={n.category === "REMEDIATION" ? "warning" : n.category === "COMMENDATION" ? "success" : "neutral"}>{n.category.charAt(0) + n.category.slice(1).toLowerCase()}</Badge>
                    <span>{n.author}</span><span className="font-mono">{formatDateTime(n.createdAt)}</span>
                    {n.moduleKey && <span>· {mods.find((m) => m.key === n.moduleKey)?.title ?? n.moduleKey}</span>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{n.body}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel aria-labelledby="add-h">
          <PanelHeader title="Add a note" id="add-h" />
          <div className="p-6">
            {canWrite ? <NoteForm traineeId={trainee.id} modules={available.map((m) => ({ key: m.key, title: m.title }))} /> : <p className="text-sm text-fg-muted">Your role does not include writing supervisor notes.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

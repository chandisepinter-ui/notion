import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatDateTime, getCompetencyRecords, getModulesWithProgress, getVisibleTrainees } from "@/lib/academy/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState, PlannedFeature } from "@/components/ui/Planned";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { moduleStatusBadge } from "@/components/academy/AcademyRoadmap";

export const metadata: Metadata = { title: "Trainees" };

export default async function SupervisorPage() {
  const user = await requirePermission(PERMISSIONS.SUPERVISOR_TRAINEES_VIEW);
  const viewAll = user.permissions.has(PERMISSIONS.SUPERVISOR_TRAINEES_VIEW_ALL);
  const trainees = await getVisibleTrainees(user.id, viewAll);
  const rows = await Promise.all(
    trainees.map(async (t) => {
      const [mods, comps] = await Promise.all([getModulesWithProgress(t.id), getCompetencyRecords(t.id)]);
      const available = mods.filter((m) => m.status === "AVAILABLE");
      const lastActivity = mods.map((m) => m.progress?.updatedAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
      return { t, available, comps, lastActivity, remediation: comps.filter((c) => c.level === "REMEDIATION").length, mastered: comps.filter((c) => c.level === "MASTERY_DEMONSTRATED").length };
    }),
  );
  const needsAttention = rows.filter((r) => r.remediation > 0);
  return (
    <>
      <PageHeader
        eyebrow={viewAll ? "All trainees · senior oversight" : "Assigned trainees"}
        title="Trainee oversight"
        description={viewAll ? "You can see every operator in training." : "You see operators assigned to you. Assignments are managed by an administrator."}
      />
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Trainees visible to you" value={rows.length} />
          <Stat label="Need remediation" value={needsAttention.length} tone={needsAttention.length ? "danger" : undefined} />
          <Stat label="Competencies at mastery" value={rows.reduce((n, r) => n + r.mastered, 0)} />
        </div>
        <Panel aria-labelledby="trainees">
          <PanelHeader title="Trainees" id="trainees" />
          {rows.length === 0 ? (
            <EmptyState icon={<Users className="size-5" />} title="No trainees assigned">An administrator can assign trainees to you.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map(({ t, available, lastActivity, remediation, mastered, comps }) => (
                <li key={t.id}>
                  <Link href={`/supervisor/trainees/${t.id}`} className="grid gap-4 px-6 py-5 transition hover:bg-surface-2/60 md:grid-cols-[1.2fr_1.6fr_auto] md:items-center">
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-fg">{t.displayName} {t.isDemo && <Badge>Demo</Badge>}</p>
                      <p className="text-sm text-fg-subtle">{t.title} · {t.shift ?? "No shift"} · Last activity {formatDateTime(lastActivity)}</p>
                    </div>
                    <div className="grid gap-2">
                      {available.map((m) => (
                        <div key={m.key} className="grid gap-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-fg-muted">{m.title}</span>{moduleStatusBadge(m)}</div>
                          <ProgressBar value={m.progress?.percent ?? 0} label={`${t.displayName}: ${m.title}`} tone={m.progress?.status === "PASSED" ? "success" : "accent"} />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {remediation > 0 && <Badge tone="danger">{remediation} in remediation</Badge>}
                      <span className="text-fg-subtle">{mastered}/{comps.length} mastered</span>
                      <ArrowUpRight aria-hidden className="size-4 text-fg-subtle" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="grid gap-4 md:grid-cols-3">
          <PlannedFeature title="Day 7 evaluation" phase={3}>Eight-hour simulated validation shift with structured supervisor scoring.</PlannedFeature>
          <PlannedFeature title="Graduation approval" phase={3}>Approve or withhold graduation with documented rationale; unlocks the Reference Center.</PlannedFeature>
          <PlannedFeature title="Assign refreshers" phase={3}>Assign targeted refresher training with due dates.</PlannedFeature>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="titan-panel p-5">
      <p className="titan-eyebrow flex items-center gap-2"><ClipboardCheck aria-hidden className="size-3.5" />{label}</p>
      <p className={tone === "danger" ? "mt-2 text-3xl font-semibold text-danger" : "mt-2 text-3xl font-semibold text-fg"}>{value}</p>
    </div>
  );
}

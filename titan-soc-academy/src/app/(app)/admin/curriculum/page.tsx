import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { TriangleAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { LESSON_MODULES } from "@/content/curriculum";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { PlannedBadge } from "@/components/ui/Planned";

export const metadata: Metadata = { title: "Curriculum" };

export default async function CurriculumPage() {
  await requirePermission(PERMISSIONS.ADMIN_CURRICULUM_VIEW);
  const [days, modules] = await Promise.all([
    db.select().from(schema.academyDays).orderBy(asc(schema.academyDays.dayNumber)),
    db.select().from(schema.modules).orderBy(asc(schema.modules.dayNumber), asc(schema.modules.sortOrder)),
  ]);
  const built = Object.values(LESSON_MODULES);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Curriculum" description="Modules are defined as structured content. Items flagged below must be approved by Titan subject-matter experts before training is used for certification." />
      <div className="grid grid-cols-1 gap-6">
        <Panel aria-labelledby="pending">
          <PanelHeader title="Pending SME approval" id="pending" eyebrow="Do not treat as policy" />
          <ul className="grid gap-3 p-6">
            {built.flatMap((m) => m.pendingApproval.map((p) => ({ m, p }))).map(({ m, p }, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                <div><p className="text-fg">{p}</p><p className="mt-1 text-xs text-fg-subtle">{m.title}</p></div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel aria-labelledby="mods">
          <PanelHeader title="Modules by day" id="mods" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <caption className="sr-only">Academy modules</caption>
              <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-fg-subtle"><th scope="col" className="px-6 py-3 font-medium">Day</th><th scope="col" className="px-3 py-3 font-medium">Module</th><th scope="col" className="px-3 py-3 font-medium">Status</th><th scope="col" className="px-6 py-3 font-medium">Content</th></tr></thead>
              <tbody className="divide-y divide-line">
                {modules.map((m) => {
                  const c = LESSON_MODULES[m.key];
                  return (
                    <tr key={m.id}>
                      <td className="px-6 py-3 font-mono text-fg-muted">D{m.dayNumber} · {days.find((d) => d.dayNumber === m.dayNumber)?.title}</td>
                      <td className="px-3 py-3"><span className="font-medium text-fg">{m.title}</span><span className="block font-mono text-xs text-fg-subtle">{m.key}</span></td>
                      <td className="px-3 py-3">{m.status === "AVAILABLE" ? <Badge tone="success">Available{m.isPreview ? " · preview" : ""}</Badge> : <PlannedBadge />}</td>
                      <td className="px-6 py-3 text-fg-muted">{c ? `v${c.version} · ${c.steps.length} steps · ${c.scenarios.length} scenarios · ${c.competencies.length} competencies` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

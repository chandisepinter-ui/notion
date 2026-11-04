import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { CheckCircle2, Gavel } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { getTitanCatalog } from "@/content/titan-catalog";
import { formatDateTime } from "@/lib/academy/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Planned";
import { DecisionForm } from "@/components/academy/DecisionForm";

export const metadata: Metadata = { title: "Content Decisions" };

const CHOICE_LABEL: Record<string, string> = { A: "Source A", B: "Source B", CUSTOM: "Own ruling", NOT_APPLICABLE: "Not applicable" };

export default async function DecisionsPage() {
  await requirePermission(PERMISSIONS.CONTENT_DECIDE);
  const catalog = getTitanCatalog();
  const history = await db
    .select({ id: schema.contentDecisions.id, conflictId: schema.contentDecisions.conflictId, choice: schema.contentDecisions.choice, ruling: schema.contentDecisions.ruling, createdAt: schema.contentDecisions.createdAt, by: schema.users.displayName })
    .from(schema.contentDecisions)
    .innerJoin(schema.users, eq(schema.users.id, schema.contentDecisions.decidedById))
    .orderBy(desc(schema.contentDecisions.createdAt));
  const current = new Map<string, (typeof history)[number]>();
  for (const h of history) if (!current.has(h.conflictId)) current.set(h.conflictId, h);

  if (!catalog) {
    return (
      <>
        <PageHeader eyebrow="Administration" title="Content decisions" />
        <Panel><EmptyState icon={<Gavel className="size-5" />} title="No imported Titan content on this computer">Run <code className="font-mono">npm run content:import</code> first.</EmptyState></Panel>
      </>
    );
  }
  const open = catalog.conflicts.filter((c) => c.status === "OPEN");
  const decided = open.filter((c) => current.has(c.id)).length;
  const moduleTitle = (k: string) => catalog.modules.find((m) => m.key === k)?.title ?? k;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Content decisions"
        description="Rule on each conflict between Titan sources. Your ruling is shown to operators wherever the conflict affects a lesson or question, and every ruling is kept in the audit log. Update the source content afterwards and re-import to make the lesson text itself match."
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone={decided === open.length ? "success" : "warning"}>{decided} of {open.length} open conflicts decided</Badge>
        <span className="text-sm text-fg-subtle">Already resolved in the source catalog: {catalog.conflicts.filter((c) => c.status !== "OPEN").map((c) => c.id).join(", ") || "none"}</span>
      </div>
      <ol className="grid gap-5">
        {open.map((c) => {
          const cur = current.get(c.id);
          return (
            <li key={c.id}>
              <Panel className="p-6" aria-labelledby={`h-${c.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`h-${c.id}`} className="text-lg font-semibold text-fg">{c.id}</h2>
                  {cur ? <Badge tone="success"><CheckCircle2 aria-hidden className="size-3" /> Decided · {CHOICE_LABEL[cur.choice]}</Badge> : <Badge tone="warning">Open</Badge>}
                  <span className="text-sm text-fg-subtle">Suggested owner: {c.owner}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-line p-4"><p className="titan-eyebrow mb-1.5">Source A</p><p className="text-sm text-fg">{c.a}</p></div>
                  <div className="rounded-xl border border-line p-4"><p className="titan-eyebrow mb-1.5">Source B</p><p className="text-sm text-fg">{c.b}</p></div>
                </div>
                <dl className="mt-3 grid gap-1 text-sm">
                  <div><dt className="inline font-medium text-fg">Affects: </dt><dd className="inline text-fg-muted">{c.impact}</dd></div>
                  {(c.modules ?? []).length > 0 && <div><dt className="inline font-medium text-fg">Modules: </dt><dd className="inline text-fg-muted">{c.modules!.map((m) => `${m} ${moduleTitle(m)}`).join(" · ")}</dd></div>}
                  <div><dt className="inline font-medium text-fg">Until decided: </dt><dd className="inline text-fg-muted">{c.handling}</dd></div>
                </dl>
                {cur && (
                  <div className="mt-4 rounded-xl border border-success/40 bg-success-soft p-4 text-sm">
                    <p className="font-medium text-fg">Current ruling</p>
                    <p className="mt-1 whitespace-pre-wrap text-fg">{cur.ruling}</p>
                    <p className="mt-1 text-xs text-fg-subtle">{cur.by} · {formatDateTime(cur.createdAt)}</p>
                  </div>
                )}
                <div className="mt-5 border-t border-line pt-5">
                  <DecisionForm conflictId={c.id} a={c.a} b={c.b} current={cur ? { choice: cur.choice, ruling: cur.ruling } : undefined} />
                </div>
              </Panel>
            </li>
          );
        })}
      </ol>
    </>
  );
}

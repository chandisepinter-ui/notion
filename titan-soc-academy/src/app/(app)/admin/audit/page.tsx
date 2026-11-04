import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { formatDateTime } from "@/lib/academy/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/Planned";

export const metadata: Metadata = { title: "Audit Log" };

export default async function AuditPage() {
  await requirePermission(PERMISSIONS.ADMIN_AUDIT_VIEW);
  const target = alias(schema.users, "target");
  const rows = await db
    .select({ id: schema.auditLog.id, action: schema.auditLog.action, detail: schema.auditLog.detailJson, createdAt: schema.auditLog.createdAt, actor: schema.users.displayName, target: target.displayName })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
    .leftJoin(target, eq(target.id, schema.auditLog.targetId))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(200);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit log" description="Administrative and supervisory changes, newest first." />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState title="No administrative changes recorded yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Audit log</caption>
              <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-fg-subtle"><th scope="col" className="px-6 py-3 font-medium">When</th><th scope="col" className="px-3 py-3 font-medium">Who</th><th scope="col" className="px-3 py-3 font-medium">Action</th><th scope="col" className="px-3 py-3 font-medium">Affected</th><th scope="col" className="px-6 py-3 font-medium">Detail</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 font-mono text-xs text-fg-subtle">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-3 text-fg">{r.actor ?? "—"}</td>
                    <td className="px-3 py-3 font-mono text-xs text-fg">{r.action}</td>
                    <td className="px-3 py-3 text-fg">{r.target ?? "—"}</td>
                    <td className="px-6 py-3 font-mono text-xs text-fg-muted">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

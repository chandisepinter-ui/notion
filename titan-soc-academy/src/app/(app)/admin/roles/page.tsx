import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { Check, Minus } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

export const metadata: Metadata = { title: "Permission Matrix" };

export default async function RolesPage() {
  await requirePermission(PERMISSIONS.ADMIN_ROLES_VIEW);
  const [roles, perms, rp] = await Promise.all([
    db.select().from(schema.roles).orderBy(asc(schema.roles.rank)),
    db.select().from(schema.permissions).orderBy(asc(schema.permissions.category), asc(schema.permissions.key)),
    db.select().from(schema.rolePermissions),
  ]);
  const has = (roleId: string, key: string) => rp.some((x) => x.roleId === roleId && x.permissionKey === key);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Permission matrix" description="The application checks permissions — never individual names. This matrix is read from the database; editing it through this screen is planned for Phase 5." />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Permissions held by each role</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-6 py-4 font-medium text-fg-subtle">Permission</th>
                {roles.map((r) => <th key={r.id} scope="col" className="px-3 py-4 text-center font-semibold text-fg">{r.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {perms.map((p) => (
                <tr key={p.key}>
                  <th scope="row" className="px-6 py-3 font-normal">
                    <span className="block text-fg">{p.description}</span>
                    <span className="font-mono text-xs text-fg-subtle">{p.category} · {p.key}</span>
                  </th>
                  {roles.map((r) => (
                    <td key={r.id} className="px-3 py-3 text-center">
                      {has(r.id, p.key) ? <Check aria-label="Granted" className="mx-auto size-4 text-success" /> : <Minus aria-label="Not granted" className="mx-auto size-4 text-fg-subtle/50" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

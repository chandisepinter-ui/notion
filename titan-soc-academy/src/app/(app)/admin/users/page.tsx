import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { AssignmentManager, RoleToggles } from "@/components/academy/AdminControls";

export const metadata: Metadata = { title: "Accounts & Roles" };

export default async function UsersPage() {
  const me = await requirePermission(PERMISSIONS.ADMIN_USERS_MANAGE);
  const [users, roles, userRoles, assignments, rolePerms] = await Promise.all([
    db.select().from(schema.users).orderBy(asc(schema.users.displayName)),
    db.select().from(schema.roles).orderBy(asc(schema.roles.rank)),
    db.select().from(schema.userRoles),
    db.select().from(schema.supervisorAssignments),
    db.select().from(schema.rolePermissions),
  ]);
  const rolesOf = (uid: string) => userRoles.filter((ur) => ur.userId === uid).map((ur) => roles.find((r) => r.id === ur.roleId)!.key);
  // Supervisors / trainees are determined by PERMISSION, not by name.
  const roleIdsWith = (perm: string) => new Set(rolePerms.filter((rp) => rp.permissionKey === perm).map((rp) => rp.roleId));
  const supRoles = roleIdsWith(PERMISSIONS.SUPERVISOR_TRAINEES_VIEW);
  const opRole = roles.find((r) => r.key === "OPERATOR");
  const supervisors = users.filter((u) => userRoles.some((ur) => ur.userId === u.id && supRoles.has(ur.roleId)));
  const trainees = users.filter((u) => userRoles.some((ur) => ur.userId === u.id && ur.roleId === opRole?.id));
  return (
    <>
      <PageHeader eyebrow="Administration" title="Accounts & Roles" description="Grant or remove roles and assign trainees to supervisors. Changes take effect on the person’s next page load and are recorded in the audit log." />
      <div className="grid grid-cols-1 gap-6">
        <Panel aria-labelledby="accts">
          <PanelHeader title="Accounts" id="accts" eyebrow={`${users.length} accounts`} />
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_1.3fr] md:items-center">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-medium text-fg">{u.displayName}{u.isDemo && <Badge>Demo</Badge>}{u.id === me.id && <Badge tone="accent">You</Badge>}</p>
                  <p className="text-sm text-fg-subtle">{u.email} · {u.shift ?? "No shift"}</p>
                </div>
                <RoleToggles userId={u.id} roles={roles.map((r) => ({ key: r.key, name: r.name }))} held={rolesOf(u.id)} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel aria-labelledby="assign">
          <PanelHeader title="Supervisor assignments" id="assign" eyebrow="Who reviews whom" />
          <div className="p-6">
            <AssignmentManager
              supervisors={supervisors.map((s) => ({ id: s.id, name: s.displayName }))}
              trainees={trainees.map((s) => ({ id: s.id, name: s.displayName }))}
              assignments={assignments.map(({ supervisorId, traineeId }) => ({ supervisorId, traineeId }))}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

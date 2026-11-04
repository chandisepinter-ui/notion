import type { Metadata } from "next";
import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { ArrowUpRight } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlannedFeature } from "@/components/ui/Planned";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminPage() {
  await requirePermission(PERMISSIONS.ADMIN_USERS_MANAGE);
  const [[users], [roles], [modules], [available], [attempts], [progress]] = await Promise.all([
    db.select({ n: count() }).from(schema.users),
    db.select({ n: count() }).from(schema.roles),
    db.select({ n: count() }).from(schema.modules),
    db.select({ n: count() }).from(schema.modules).where(eq(schema.modules.status, "AVAILABLE")),
    db.select({ n: count() }).from(schema.trainingAttempts),
    db.select({ n: count() }).from(schema.moduleProgress),
  ]);
  const cards = [
    { href: "/admin/users", label: "Accounts", value: users.n, note: "Accounts, role assignments and supervisor assignments" },
    { href: "/admin/roles", label: "Roles", value: roles.n, note: "Permission matrix (database-driven)" },
    { href: "/admin/curriculum", label: "Modules", value: `${available.n}/${modules.n}`, note: "Available / total, plus items pending SME approval" },
    { href: "/admin/audit", label: "Graded answers", value: attempts.n, note: `${progress.n} module progress record(s)` },
  ];
  return (
    <>
      <PageHeader eyebrow="Administration" title="Academy administration" description="Manage who can do what, review curriculum status and audit administrative changes. All figures below are live counts from the database." />
      <div className="grid grid-cols-1 gap-6">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="titan-panel flex h-full flex-col p-5 transition hover:border-accent-line">
                <p className="titan-eyebrow flex items-center justify-between">{c.label}<ArrowUpRight aria-hidden className="size-4" /></p>
                <p className="mt-3 text-3xl font-semibold text-fg">{c.value}</p>
                <p className="mt-1 text-sm text-fg-muted">{c.note}</p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <PlannedFeature title="Create & deactivate accounts" phase={5}>Arrives with company sign-in (Microsoft Entra ID), so accounts are tied to real identities.</PlannedFeature>
          <PlannedFeature title="Curriculum & scenario editor" phase={5}>Author modules and scenarios through forms instead of code, with SME approval workflow.</PlannedFeature>
          <PlannedFeature title="Role permission editing" phase={5}>Change which permissions each role holds. The data model already supports it.</PlannedFeature>
          <PlannedFeature title="Training assignments" phase={3}>Assign modules and refreshers with due dates.</PlannedFeature>
          <PlannedFeature title="Arcade configuration" phase={4}>Daily challenges, Test-mode eligibility and team competitions.</PlannedFeature>
          <PlannedFeature title="Reporting & export" phase={5}>Cohort reports and exports for leadership.</PlannedFeature>
        </div>
      </div>
    </>
  );
}

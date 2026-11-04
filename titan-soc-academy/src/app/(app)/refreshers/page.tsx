import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, PlannedFeature } from "@/components/ui/Planned";

export const metadata: Metadata = { title: "Refreshers" };

export default async function RefreshersPage() {
  await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  return (
    <>
      <PageHeader eyebrow="Continuing education" title="Refreshers" description="Short assignments from your supervisor or scheduled reinforcement of skills you have not used recently." />
      <div className="grid grid-cols-1 gap-6">
        <Panel>
          <EmptyState icon={<RefreshCw className="size-5" />} title="No refresher assignments">Assignments will appear here when supervisors can assign them.</EmptyState>
        </Panel>
        <PlannedFeature title="Refresher assignments" phase={3}>
          Supervisors will assign targeted refreshers (for example, after a quality-assurance finding), with due dates and completion tracking. Automatic reinforcement of missed concepts is also planned.
        </PlannedFeature>
      </div>
    </>
  );
}

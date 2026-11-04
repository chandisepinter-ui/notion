import type { Metadata } from "next";
import { History } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAttempts } from "@/lib/academy/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/Planned";
import { AttemptTable } from "@/components/academy/AttemptTable";

export const metadata: Metadata = { title: "Training History" };

export default async function HistoryPage() {
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const attempts = await getAttempts(user.id);
  return (
    <>
      <PageHeader eyebrow="Every graded decision" title="Training History" description="Each answer you submit is recorded — including wrong ones. Supervisors see the same record when reviewing your training." />
      <Panel>
        {attempts.length === 0 ? (
          <EmptyState icon={<History className="size-5" />} title="No answers recorded yet">Your graded decisions appear here once you begin training.</EmptyState>
        ) : (
          <AttemptTable attempts={attempts} caption="My graded answers" />
        )}
      </Panel>
    </>
  );
}

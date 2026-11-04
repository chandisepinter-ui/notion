import type { Metadata } from "next";
import { BookLock } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { PlannedFeature } from "@/components/ui/Planned";

export const metadata: Metadata = { title: "Reference Center" };

export default async function ReferencePage() {
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const unlocked = !!user.graduatedAt || user.permissions.has(PERMISSIONS.REFERENCE_ACCESS_ANYTIME);
  return (
    <>
      <PageHeader eyebrow="Searchable operational reference" title="Reference Center" description="Approved procedures, system guides and quick references — searchable from one place." />
      <div className="grid grid-cols-1 gap-6">
        <Panel className="p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-3 text-fg-subtle"><BookLock aria-hidden className="size-5" /></span>
            <div>
              <p className="font-semibold text-fg">{unlocked ? "Your role has Reference Center access" : "Unlocks after graduation"}</p>
              <p className="mt-1 text-sm text-fg-muted">
                {unlocked
                  ? "When reference content is published, you will be able to open it here."
                  : "Operators gain access after a supervisor approves graduation on Day 7, so the Academy is completed first."}
              </p>
            </div>
          </div>
        </Panel>
        <PlannedFeature title="Reference content and search" phase={5}>
          Requires Titan-approved SOPs and system references. No reference material has been published in this build, and none will be written without approved source documents.
        </PlannedFeature>
      </div>
    </>
  );
}

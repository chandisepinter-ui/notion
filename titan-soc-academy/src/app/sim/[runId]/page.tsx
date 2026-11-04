import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadRun, runView } from "@/lib/sim/service";
import { ImmixWorkstation } from "@/components/sim/ImmixWorkstation";

export const metadata: Metadata = { title: "IMMIX Simulator" };

/** Full-screen workstation (outside the Academy shell, like the real console). */
export default async function SimRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const loaded = await loadRun(runId, user.id);
  if (!loaded) notFound();
  return <ImmixWorkstation initial={runView(loaded.run, loaded.entry, loaded.state)} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadRun, runView } from "@/lib/sim/service";
import { MultiviewWindow } from "@/components/immix/MultiviewWindow";

export const metadata: Metadata = { title: "MultiView" };

/** IMMIX MultiView opens in its own browser window, as on the live system. */
export default async function MultiviewPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const loaded = await loadRun(runId, user.id);
  if (!loaded) notFound();
  return <MultiviewWindow initial={runView(loaded.run, loaded.entry, loaded.state)} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadRun, runView } from "@/lib/sim/service";
import { DetailsWindow } from "@/components/immix/DetailsWindow";

export const metadata: Metadata = { title: "Site Details" };

/** IMMIX "Details" opens a separate window with the site's details, call list and arming schedule. */
export default async function DetailsPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const loaded = await loadRun(runId, user.id);
  if (!loaded) notFound();
  return <DetailsWindow initial={runView(loaded.run, loaded.entry, loaded.state)} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { MonitorPlay, Play } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db/client";
import { listScenarios } from "@/lib/sim/catalog";
import { startSimRun } from "@/lib/sim/actions";
import { formatDateTime } from "@/lib/academy/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Planned";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Simulator" };

/** Which Computer 2 app each unsupported check needs. */
const APP: Record<string, string> = {
  SEARCHED_HUBSPOT: "HubSpot", TICKETS_CREATED: "HubSpot", TICKET_BEFORE_CLOSE: "HubSpot", TICKET_COMPLETE: "HubSpot", TICKET_NOTE_ADDED: "HubSpot", CLOSED_AFTER_PARK_MIN: "HubSpot",
  CALL_LINES: "Dialpad (phone)", PASSWORD_VERIFIED: "Dialpad (phone)", VALIDATION_RECORDED: "Dialpad (phone)",
  SEARCHED_TRACKTIK: "TrackTik", DISPATCH_SENT: "TrackTik", DISPATCH_ASSIGNED_TO: "TrackTik", DISPATCH_URGENT: "TrackTik",
  RADIO_TX: "Radio", RADIO_LOG_KINDS: "Radio Log", PHONETIC_USED: "Radio",
  EMAIL_SENT: "Outlook", TEAMS_POSTED: "Teams", TEAMS_NOT_IN: "Teams", PASSDOWN_ELEMENTS: "Shift Passdown", PASSDOWN_MENTIONS: "Shift Passdown",
};

export default async function SimulatorPage() {
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const scenarios = listScenarios();
  const runs = await db.select().from(schema.simRuns).where(eq(schema.simRuns.userId, user.id)).orderBy(desc(schema.simRuns.startedAt)).limit(12);
  const title = (id: string) => scenarios.find((s) => s.scenario.id === id)?.scenario.title ?? id;
  return (
    <>
      <PageHeader
        eyebrow="Computer 1 · IMMIX"
        title="SOC Simulator"
        description="Work realistic alarms on a simulated IMMIX workstation. Practice runs are open any time and are scored the same way as Academy checks: 90% with no critical misses. Scenarios that also need Computer 2 (HubSpot, TrackTik, phones, radio, Outlook/Teams) unlock as those apps are built."
      />
      <div className="grid grid-cols-1 gap-6">
        <ul className="grid gap-4 md:grid-cols-2">
          {scenarios.map(({ scenario: s, playable, missing }) => {
            const apps = [...new Set(missing.map((m) => APP[m] ?? m))];
            return (
              <li key={s.id} className="titan-panel flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-fg-subtle">{s.id}</span>
                  {s.fictional ? <Badge tone="accent">Fictional practice</Badge> : <Badge>Titan scenario{s.moduleId ? ` · ${s.moduleId}` : ""}</Badge>}
                  {playable ? <Badge tone="success">Playable</Badge> : <Badge tone="planned">Needs Computer 2</Badge>}
                </div>
                <h2 className="font-semibold text-fg">{s.title}</h2>
                <p className="text-sm text-fg-muted">{s.brief}</p>
                {missing.length > 0 && (
                  <p className="text-xs text-fg-subtle">{playable ? "Some checks are not scored yet — they need" : "Requires"}: {apps.join(", ")}.</p>
                )}
                <div className="mt-auto pt-2">
                  {playable ? (
                    <form action={startSimRun}>
                      <input type="hidden" name="scenarioId" value={s.id} />
                      <input type="hidden" name="mode" value="practice" />
                      <button type="submit" className={buttonClass("primary", "md")}><Play aria-hidden className="size-4" /> Start practice</button>
                    </form>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line-strong px-3 py-2 text-center text-sm text-fg-subtle">Unlocks when {apps.join(" and ")} {apps.length > 1 ? "are" : "is"} simulated</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <Panel aria-labelledby="runs">
          <PanelHeader title="My recent runs" id="runs" />
          {runs.length === 0 ? (
            <EmptyState icon={<MonitorPlay className="size-5" />} title="No simulator runs yet" />
          ) : (
            <ul className="divide-y divide-line px-6 py-2">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-fg">{title(r.scenarioId)}</span>
                  <Badge>{r.mode}</Badge>
                  {r.status === "COMPLETED" ? <Badge tone={r.passed ? "success" : "danger"}>{r.scorePercent}% · {r.passed ? "passed" : "not passed"}</Badge> : <Badge tone="accent">In progress</Badge>}
                  <span className="font-mono text-xs text-fg-subtle">{formatDateTime(r.startedAt)}</span>
                  <Link href={`/sim/${r.id}`} className="text-accent-strong hover:underline">{r.status === "COMPLETED" ? "Results" : "Resume"}</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

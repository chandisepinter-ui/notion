"use client";
/**
 * IMMIX MultiView window. Receives the live run state from the workstation
 * window over a BroadcastChannel and reports when it is opened and closed,
 * so "watched on MultiView" is measured exactly like the real workflow.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import type { SimScenario, SimState } from "@/lib/sim/types";
import type { RunView } from "@/lib/sim/service";
import { MultiviewGrid } from "@/components/sim/ImmixWorkstation";

export function MultiviewWindow({ initial }: { initial: RunView }) {
  const [state, setState] = useState<SimState>(initial.state as unknown as SimState);
  const [clock, setClock] = useState(initial.state.clock);
  const [finished, setFinished] = useState(false);
  const [connected, setConnected] = useState(false);
  const ch = useRef<BroadcastChannel | null>(null);
  const scn = initial.scenario as unknown as SimScenario;

  useEffect(() => {
    const c = new BroadcastChannel(`immix-${initial.runId}`);
    ch.current = c;
    c.onmessage = (e) => {
      if (e.data?.type === "state") {
        setState(e.data.state);
        setClock(e.data.clock);
        if (!connected) {
          setConnected(true);
        }
      }
      if (e.data?.type === "finished") setFinished(true);
    };
    c.postMessage({ type: "multiview-open" });
    const bye = () => c.postMessage({ type: "multiview-close" });
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      bye();
      c.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.runId]);

  const alert = scn.alerts.find((a) => state.alerts[a.id]?.status === "open") ?? scn.alerts[0];
  const site = scn.sites.find((s) => s.id === alert.siteId)!;
  const offSiteCams = useMemo(() => new Set(scn.alerts.filter((a) => Object.values(a.clips ?? {}).some((c) => c?.beats.some((b) => !b.onSite))).map((a) => a.cameraId)), [scn]);
  const ecareFailed = (cam: string) => scn.alerts.some((a) => a.type === "ECARE_FAILURE" && a.cameraId === cam && a.siteId === site.id && state.alerts[a.id]?.status !== "pending" && !state.alerts[a.id]?.reconnected);
  const now = new Date(initial.scenario.startLocal);
  now.setSeconds(now.getSeconds() + Math.floor(clock));

  return (
    <div className="min-h-dvh bg-[#1f1f1f] text-[13px] text-white" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div className="h-6 bg-[#282828]" />
      <div className="flex items-center justify-between border-y border-black px-2 py-2">
        <button type="button" disabled className="h-[27px] w-20 rounded-[2px] border border-[#9e9e9e] bg-[#6a6c6c] text-[#bdbdbd]">Previous</button>
        <span className="inline-flex items-center gap-1 border border-[#bdbdbd] bg-black px-1 font-bold">All<ChevronDown aria-hidden className="size-3" /></span>
        <button type="button" disabled className="h-[27px] w-20 rounded-[2px] border border-[#9e9e9e] bg-[#6a6c6c] text-[#bdbdbd]">Next</button>
      </div>
      <h1 className="sr-only">MultiView — {site.name}</h1>
      {finished && <p role="status" className="bg-[#0b2a4d] px-3 py-2">This training run has ended. You can close this window.</p>}
      {!connected && !finished && <p role="status" className="px-3 py-2 text-[#cfcfcf]">Connecting to the workstation…</p>}
      <div className="flex gap-2 px-2 pt-2">
        <ArrowLeftRight aria-hidden className="mt-56 size-4 shrink-0 text-[#9e9e9e]" />
        <div className="flex-1"><MultiviewGrid site={site} scn={scn} state={state} clock={clock} now={now} media={initial.media} offSiteCams={offSiteCams} ecareFailed={ecareFailed} /></div>
      </div>
    </div>
  );
}

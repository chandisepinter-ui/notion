"use client";
import { useEffect, useState } from "react";
import type { SimScenario, SimState } from "@/lib/sim/types";
import type { RunView } from "@/lib/sim/service";
import { SiteDetailsContent } from "./ImmixScreens";

function phone(site: { notes: string[] }, word: RegExp) {
  for (const n of site.notes) if (word.test(n)) { const m = n.match(/\(?\d{3}\)?[\s.-]?\d{3}-\d{4}/); if (m) return m[0]; }
  return null;
}

export function DetailsWindow({ initial }: { initial: RunView }) {
  const scn = initial.scenario as unknown as SimScenario;
  const [state, setState] = useState<SimState>(initial.state as unknown as SimState);
  useEffect(() => {
    const c = new BroadcastChannel(`immix-${initial.runId}`);
    c.onmessage = (e) => e.data?.type === "state" && setState(e.data.state);
    return () => c.close();
  }, [initial.runId]);
  const alert = scn.alerts.find((a) => state.alerts[a.id]?.status === "open") ?? scn.alerts[0];
  const site = scn.sites.find((s) => s.id === alert.siteId)!;
  return (
    <main className="min-h-dvh bg-[#1f1f1f]" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <h1 className="sr-only">Site Details : {site.name}</h1>
      <SiteDetailsContent site={site} policePhone={phone(site, /police/i)} firePhone={phone(site, /fire/i)} />
    </main>
  );
}

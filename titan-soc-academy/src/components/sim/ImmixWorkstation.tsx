"use client";
/**
 * IMMIX simulator — replica of the Titan IMMIX Cloud operator screens, built
 * from the sanitized reference screenshots (content-import/reference/immix):
 * Alarms home, event screen (event clip, Cameras/Audio/Edge Devices, live view,
 * bottom tabs), Close Event (two-level outcome), Park Event, MultiView window.
 *
 * Every operator action is recorded and sent to the server, which keeps the
 * authoritative run and scores it. Answer keys never reach this component.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, AlignJustify, BarChart3, BellRing, Camera, CheckCircle2, ChevronDown, ChevronLeft, CircleHelp, Clock3, Download, ExternalLink, FastForward, Grid3x3, Image as ImageIcon,
  Info, ListChecks, Loader2, LogOut, Minus, Pause, Pencil, Play, Plus, PlusCircle, Recycle, Settings, ShieldCheck, User, Video, Volume2, X, XCircle, ZoomIn, ZoomOut,
} from "lucide-react";
import { applyAction, SimError, subjectOnCamera, tick } from "@/lib/sim/engine";
import type { SimAction, SimScenario, SimState } from "@/lib/sim/types";
import { finishSimRun, sendSimActions } from "@/lib/sim/actions";
import type { RunView } from "@/lib/sim/service";
import { ImmixCamera } from "@/components/immix/ImmixCamera";
import { cn } from "@/lib/cn";

type Alert = RunView["scenario"]["alerts"][number];
type Site = SimScenario["sites"][number];

/* IMMIX palette (measured from the reference screenshots) */
const C = {
  page: "#343434", body: "#3c3c3c", tabbar: "#1f1f1f", tabSel: "#505050", dark: "#282828", hdr: "#232424",
  btnFrom: "#8f9191", btnTo: "#6a6c6c", red: "#b84141", blue: "#006699", alarmRed: "#cc1919", orange: "#cc630d", process: "#0151a3",
};
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

function wall(startLocal: string, sec: number) {
  const d = new Date(startLocal);
  d.setSeconds(d.getSeconds() + Math.floor(sec));
  return d;
}
const two = (n: number) => String(n).padStart(2, "0");
const clockText = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
const immixDate = (d: Date) => {
  const h = d.getHours() % 12 || 12;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${two(d.getMinutes())}:${two(d.getSeconds())} ${d.getHours() < 12 ? "AM" : "PM"}`;
};
const mmss = (s: number) => `${two(Math.floor(s / 60))}:${two(Math.floor(s % 60))}`;

/** Outcome → sub-outcome lists seen in the live IMMIX Close Event dialog. Others have none on file. */
const SUB_OUTCOMES: Record<string, string[]> = { eCare: ["eCare Failure", "eCare Reconnected"] };

/* ------------------------------------------------------------------ */

export function ImmixWorkstation({ initial, operatorName }: { initial: RunView; operatorName: string }) {
  const [view, setView] = useState(initial);
  const [local, setLocal] = useState<SimState>(() => ({ ...initial.state, alerts: structuredClone(initial.state.alerts) } as SimState));
  const base = useRef({ clock: initial.state.clock, t0: Date.now() });
  const [, setNow] = useState(0);
  const [toast, setToast] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [pending, setPending] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [showTasks, setShowTasks] = useState(initial.mode !== "mastery");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(0);
  const localRef = useRef(local);
  localRef.current = local;

  const scn = view.scenario as unknown as SimScenario;
  const cfg = useMemo(() => ({ outcomes: view.outcomes, defaultTalkdown: view.defaultTalkdown }), [view.outcomes, view.defaultTalkdown]);
  const done = view.status === "COMPLETED";

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [done]);
  const clock = done ? local.clock : Math.max(local.clock, base.current.clock + (Date.now() - base.current.t0) / 1000);
  const display = useMemo(() => tick(scn, structuredClone({ ...local, clock })), [scn, local, Math.floor(clock)]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(
    (action: SimAction) => {
      let next: SimState;
      try {
        next = applyAction(scn, cfg, localRef.current, action);
      } catch (e) {
        if (e instanceof SimError) setToast({ tone: "error", text: e.message });
        return false;
      }
      localRef.current = next;
      setLocal(next);
      if (action.type === "ADVANCE_TIME") base.current = { clock: next.clock, t0: Date.now() };
      inFlight.current += 1;
      setPending((p) => p + 1);
      const before = new Set(next.errors.map((e) => `${e.code}${e.at}`));
      const job = queue.current.then(async () => {
        try {
          const r = await sendSimActions(view.runId, [action]);
          inFlight.current -= 1;
          if (r.view) {
            setView(r.view);
            if (inFlight.current === 0) {
              localRef.current = r.view.state as unknown as SimState;
              setLocal(r.view.state as unknown as SimState);
            }
          }
          if (!r.ok) setToast({ tone: "error", text: r.error });
          else {
            const fresh = r.view.state.errors.find((e) => !before.has(`${e.code}${e.at}`));
            if (fresh) setToast({ tone: "error", text: fresh.message });
          }
        } catch {
          inFlight.current -= 1;
          setToast({ tone: "error", text: "Connection problem — your last actions may not be saved." });
        } finally {
          setPending((p) => p - 1);
        }
      });
      queue.current = job.catch(() => {});
      return true;
    },
    [scn, cfg, view.runId],
  );

  // MultiView window ↔ workstation (separate browser window, like IMMIX).
  const channel = useRef<BroadcastChannel | null>(null);
  const openAlertRef = useRef<string | null>(null);
  const clockRef = useRef(clock);
  clockRef.current = clock;
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(`immix-${view.runId}`);
    channel.current = ch;
    ch.onmessage = (e) => {
      const id = openAlertRef.current;
      if (!id) return;
      if (e.data?.type === "multiview-open") send({ type: "MULTIVIEW_OPEN", alertId: id, at: clockRef.current });
      if (e.data?.type === "multiview-close") send({ type: "MULTIVIEW_CLOSE", alertId: id, at: clockRef.current });
    };
    return () => ch.close();
  }, [view.runId, send]);
  useEffect(() => {
    channel.current?.postMessage({ type: "state", state: display, clock, scenario: view.scenario, media: view.media });
  });

  // Announce arriving alerts and reconnects.
  const prev = useRef(JSON.stringify(Object.fromEntries(Object.entries(display.alerts).map(([k, v]) => [k, [v.status, v.reconnected]]))));
  useEffect(() => {
    const cur = Object.fromEntries(Object.entries(display.alerts).map(([k, v]) => [k, [v.status, v.reconnected]]));
    const p = JSON.parse(prev.current) as Record<string, [string, boolean]>;
    for (const [k, [st, rc]] of Object.entries(cur)) {
      if (p[k]?.[0] === "pending" && st === "queued") setToast({ tone: "info", text: "New alarm received." });
      if (!p[k]?.[1] && rc) setToast({ tone: "info", text: "Ecare status changed for a parked event." });
    }
    prev.current = JSON.stringify(cur);
  }, [display.alerts]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const openAlert = scn.alerts.find((a) => display.alerts[a.id]?.status === "open") as Alert | undefined;
  openAlertRef.current = openAlert?.id ?? null;
  const now = wall(view.scenario.startLocal, clock);
  const unanswered = scn.alerts.filter((a) => display.alerts[a.id]?.status === "queued").length;

  const finish = async () => {
    const openCount = scn.alerts.filter((a) => !["closed", "pending"].includes(display.alerts[a.id]?.status)).length;
    if (openCount && !window.confirm(`${openCount} alert(s) are not closed. Finish and score this run anyway?`)) return;
    setFinishing(true);
    channel.current?.postMessage({ type: "finished" });
    await queue.current;
    const r = await finishSimRun(view.runId);
    setFinishing(false);
    if (r.view) setView(r.view);
    if (!r.ok) setToast({ tone: "error", text: r.error });
    window.scrollTo({ top: 0 });
  };

  if (done && view.result) return <SimResults view={view} />;

  return (
    <div className="flex min-h-dvh flex-col text-[13px] text-[#e8e8e8]" style={{ background: C.page, fontFamily: FONT }}>
      {/* Training strip — Titan Academy, outside the IMMIX application */}
      <div className="flex flex-wrap items-center gap-3 bg-[#0b1220] px-3 py-1 text-xs text-[#e7ecf4]" style={{ fontFamily: "var(--font-sans)" }}>
        <Link href={view.moduleKey ? `/academy/${view.moduleKey}` : "/simulator"} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[#a6b1c4] hover:bg-white/10 hover:text-white">
          <ChevronLeft aria-hidden className="size-3.5" /> Exit
        </Link>
        <span className="rounded border border-dashed border-white/30 px-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-[#a6b1c4]">
          Training simulation · {view.scenario.fictional ? "fictional" : view.scenario.id} · {view.mode}
        </span>
        <span className="min-w-0 flex-1 truncate">{view.scenario.title}</span>
        <span className="inline-flex items-center gap-1 font-mono" aria-label="Simulated time"><Clock3 aria-hidden className="size-3.5 text-[#7eacff]" />{clockText(now)}</span>
        {view.nextEvent !== null && (
          <button type="button" onClick={() => send({ type: "ADVANCE_TIME", seconds: Math.max(1, Math.ceil(view.nextEvent! - (clock - local.clock))), at: clock })} className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-0.5 hover:bg-white/10" title="Skip simulated time to the next scheduled event">
            <FastForward aria-hidden className="size-3" /> Skip ahead
          </button>
        )}
        {view.tasks && (
          <button type="button" onClick={() => setShowTasks((v) => !v)} aria-pressed={showTasks} className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-0.5 hover:bg-white/10">
            <ListChecks aria-hidden className="size-3" /> Tasks
          </button>
        )}
        <span className="inline-flex w-4 justify-center">{pending > 0 && <Loader2 aria-label="Saving" className="size-3.5 animate-spin text-[#a6b1c4]" />}</span>
        <button type="button" onClick={finish} disabled={finishing} className="rounded bg-[#4f8fff] px-2.5 py-1 font-semibold text-[#03101f] hover:bg-[#7eacff] disabled:opacity-60">
          {finishing ? "Scoring…" : "Finish & score"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {openAlert ? (
            <EventScreen key={openAlert.id} alert={openAlert} view={view} scn={scn} state={display} clock={clock} now={now} send={send} operatorName={operatorName} />
          ) : (
            <HomeScreen view={view} scn={scn} state={display} clock={clock} send={send} operatorName={operatorName} />
          )}
          {openAlert && (
            <div className="mt-auto border-t border-black py-0.5 text-center text-[11px] font-semibold text-white" style={{ background: C.page }} aria-live="polite">
              Current Queue Status: {unanswered} unanswered alarm{unanswered === 1 ? "" : "s"}, 0 patrols in queue.
            </div>
          )}
        </div>
        {view.tasks && showTasks && <TaskPanel view={view} />}
      </div>

      {toast && (
        <div role={toast.tone === "error" ? "alert" : "status"} className={cn("fixed bottom-8 left-1/2 z-[60] flex max-w-lg -translate-x-1/2 items-start gap-2 rounded px-4 py-3 text-sm shadow-2xl", toast.tone === "error" ? "bg-[#5c1d1a] text-white" : "bg-[#0b2a4d] text-white")} style={{ fontFamily: "var(--font-sans)" }}>
          {toast.tone === "error" ? <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> : <BellRing aria-hidden className="mt-0.5 size-4 shrink-0" />}
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="ml-2 opacity-70 hover:opacity-100"><X className="size-4" /></button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared IMMIX controls                                               */
/* ------------------------------------------------------------------ */

function IxButton({ children, className, ...p }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...p}
      className={cn("h-[27px] rounded-[2px] border border-[#9e9e9e] px-3 text-[13px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 disabled:cursor-default disabled:text-[#bdbdbd] disabled:brightness-90", className)}
      style={{ background: `linear-gradient(${C.btnFrom}, ${C.btnTo})` }}
    >
      {children}
    </button>
  );
}

function NotSimulated({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div role="status" className="fixed left-1/2 top-16 z-[60] -translate-x-1/2 rounded bg-black/85 px-4 py-2 text-xs text-white">{text}</div>;
}

/* ------------------------------------------------------------------ */
/* Tasks (guided / practice)                                           */
/* ------------------------------------------------------------------ */

function TaskPanel({ view }: { view: RunView }) {
  return (
    <aside aria-label="Scenario tasks" className="hidden w-72 shrink-0 overflow-y-auto border-l border-black bg-[#0b1220] p-4 text-sm text-[#e7ecf4] xl:block" style={{ fontFamily: "var(--font-sans)" }}>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[#8290a6]">Your situation</p>
      <p className="mt-2 leading-relaxed">{view.scenario.brief}</p>
      <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[#8290a6]">Tasks</p>
      <ol className="mt-2 grid gap-2">
        {view.scenario.tasks.map((t, i) => {
          const p = view.tasks?.find((x) => x.id === t.id);
          return (
            <li key={t.id} className={cn("rounded-xl border p-3", p?.done ? "border-[#3dd68c]/40 bg-[#3dd68c]/10" : "border-white/10")}>
              <p className="flex items-start gap-2 font-medium">
                {p?.done ? <CheckCircle2 aria-label="Done" className="mt-0.5 size-4 shrink-0 text-[#3dd68c]" /> : <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-white/30 text-[0.6rem]">{i + 1}</span>}
                {t.label}
              </p>
              {t.hint && <p className="mt-1 pl-6 text-xs text-[#a6b1c4]">{t.hint}</p>}
              {p && !p.supported && <p className="mt-1 pl-6 text-xs text-[#f5b847]">Needs Computer 2 — not evaluated yet.</p>}
            </li>
          );
        })}
      </ol>
      {view.unsupported.length > 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-white/20 p-3 text-xs text-[#a6b1c4]">Not scored in this build (needs Computer 2 apps): {view.unsupported.join("; ")}.</p>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Home — Alarms                                                       */
/* ------------------------------------------------------------------ */

function HomeScreen({ view, scn, state, clock, send, operatorName }: { view: RunView; scn: SimScenario; state: SimState; clock: number; send: (a: SimAction) => boolean; operatorName: string }) {
  const [tab, setTab] = useState<"patrols" | "parked" | "test">("patrols");
  const [note, setNote] = useState<string | null>(null);
  const site = (id: string) => scn.sites.find((s) => s.id === id);
  const queued = scn.alerts.filter((a) => state.alerts[a.id]?.status === "queued").sort((a, b) => a.atMin - b.atMin);
  const parked = scn.alerts.filter((a) => state.alerts[a.id]?.status === "parked");
  const ecareFailed = scn.alerts.filter((a) => a.type === "ECARE_FAILURE" && state.alerts[a.id]?.status !== "pending" && !state.alerts[a.id]?.reconnected).length;
  const time = (a: { atMin: number }) => immixDate(wall(view.scenario.startLocal, a.atMin * 60));
  const nav = ["Dashboard", "Alarms", "Setup", "Reports", "Events", "Cameras", "Walls"];
  return (
    <div className="flex flex-1 flex-col" style={{ background: queued.length ? C.alarmRed : "#2c2c2c" }}>
      {note && <NotSimulated text={note} onClose={() => setNote(null)} />}
      <header className="bg-[#1f1f1e]">
        <div className="mx-auto flex h-[56px] max-w-[1200px] items-center gap-3 px-4">
          <span className="flex items-center gap-2 text-[26px] font-black tracking-[0.06em] text-white" aria-hidden><span className="text-[30px] leading-none">T</span>ITAN</span>
          <span className="text-[22px] text-white">Titan Protection Monitoring/Dispatch Center</span>
          <span className="ml-auto flex items-center gap-1 text-[14px]"><User aria-hidden className="size-4" />{operatorName}<ChevronDown aria-hidden className="ml-6 size-3" /></span>
          <span className="border-l border-white/30 pl-3 text-[14px]">Logout</span>
        </div>
      </header>
      <nav aria-label="IMMIX" className="bg-[#2c2c2c]">
        <div className="mx-auto flex h-[46px] max-w-[1200px] items-stretch px-4 text-[14px]">
          {nav.map((n) => (
            <button key={n} type="button" aria-current={n === "Alarms" ? "page" : undefined} onClick={() => n !== "Alarms" && setNote(`${n} is not simulated in training.`)} className={cn("px-5 text-white", n === "Alarms" ? "bg-[#555555]" : "hover:bg-white/5")}>
              {n}
            </button>
          ))}
          <button type="button" onClick={() => setNote("Help & Support is not simulated in training.")} className="my-auto ml-auto rounded-full border border-[#9ce4ff] px-3 py-1 text-[13px] font-semibold text-white" style={{ background: C.process }}>Help &amp; Support</button>
        </div>
      </nav>
      <main id="main" className="mx-auto w-full max-w-[1182px] flex-1 px-0 py-3">
        <div className="bg-[#282828]">
          <div className="flex items-center gap-6 bg-[#363636] px-5 py-3">
            <h1 className="text-[18px] font-bold text-white">ALARMS</h1>
            <span className="ml-auto flex items-center gap-1 text-[17px] text-[#4caf50]"><ShieldCheck aria-hidden className="size-4" />{scn.sites.length} Armed Sites</span>
            <span className="flex items-center gap-1 text-[17px] text-[#e05555]"><ShieldCheck aria-hidden className="size-4" />0 Disarmed Sites</span>
            <span className="flex items-center gap-1 text-[17px] text-[#ddba3e]"><ShieldCheck aria-hidden className="size-4" />{ecareFailed} ECare Failed</span>
            <Settings aria-hidden className="size-4" /><CircleHelp aria-hidden className="size-4" />
          </div>
          <div className="grid grid-cols-[1fr_160px] gap-5 p-5">
            <div className="min-h-[540px] border border-[#666] bg-[#282828]">
              <table className="w-full text-left text-[15px]">
                <caption className="sr-only">Alarm queue</caption>
                <thead className="bg-[#555555] text-[13px] font-bold text-white">
                  <tr><th scope="col" className="px-1.5 py-1.5">TIME</th><th scope="col" className="px-1.5">LOCATION</th><th scope="col" className="px-1.5">EVENT</th><th scope="col" className="px-1.5">PRIORITY</th><th scope="col" className="px-1.5">ALARM COUNT</th><th scope="col"><span className="sr-only">Status</span></th></tr>
                </thead>
                <tbody>
                  {queued.map((a) => (
                    <tr key={a.id} className="border-b border-[#b5560b] align-top text-white" style={{ background: C.orange }}>
                      <td className="px-1.5 py-1.5">{time(a)}</td>
                      <td className="px-1.5 py-1.5">{site(a.siteId)?.name}</td>
                      <td className="px-1.5 py-1.5">{a.details}</td>
                      <td className="px-1.5 py-1.5">{a.type === "ECARE_FAILURE" ? 0 : 600}</td>
                      <td className="px-1.5 py-1.5 text-center">1</td>
                      <td className="px-2 py-1.5"><User aria-hidden className="size-4 text-white" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {queued.length === 0 && <p className="p-4 text-center text-[#cfcfcf]">No alarms waiting.</p>}
            </div>
            <div>
              <button type="button" disabled={!queued.length} onClick={() => send({ type: "OPEN_ALERT", alertId: queued[0].id, at: clock })} className="flex h-[92px] w-[152px] flex-col items-center justify-center gap-1.5 rounded-[3px] text-[15px] font-bold text-white disabled:opacity-60" style={{ background: C.process }}>
                <BellRing aria-hidden className="size-8" /> PROCESS ALARM
              </button>
            </div>
          </div>
          <div className="mx-5 border-t border-[#555]" />
          <div className="grid grid-cols-[1fr_160px] gap-5 p-5 pt-4">
            <div className="border border-[#555]">
              <div role="tablist" aria-label="Queue" className="flex bg-[#1f1f1f] text-[13px]">
                {([["patrols", "Patrols (0)"], ["parked", `Parked Events (${parked.length})`], ["test", "On Test (0)"]] as const).map(([k, l]) => (
                  <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("border-r border-black px-3 py-1.5 text-white", tab === k && "bg-[#505050]")}>{l}</button>
                ))}
              </div>
              <div role="tabpanel" className="bg-[#353535] p-4">
                {tab === "parked" && parked.length > 0 ? (
                  <table className="w-full text-left text-[13px]">
                    <thead className="font-bold"><tr><th scope="col" className="py-1">Time</th><th scope="col">Location</th><th scope="col">Event</th><th scope="col">Unparks in</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
                    <tbody>
                      {parked.map((a) => {
                        const as = state.alerts[a.id];
                        const left = as.parkedAt != null && as.parkMinutes != null ? as.parkedAt + as.parkMinutes * 60 - clock : 0;
                        return (
                          <tr key={a.id} className="border-t border-black/40">
                            <td className="py-1.5">{time(a)}</td><td>{site(a.siteId)?.name}</td><td>{a.details}</td><td className="font-mono">{mmss(Math.max(0, left))}</td>
                            <td className="text-right"><IxButton onClick={() => send({ type: "OPEN_ALERT", alertId: a.id, at: clock })}>Process</IxButton></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="flex items-center gap-3 rounded-[3px] border border-[#2e8fd0] px-4 py-3 text-[13px] font-semibold text-[#9ed2ff]">
                    <Info aria-hidden className="size-4" /> {tab === "patrols" ? "No Patrols" : tab === "parked" ? "No Parked Events" : "No Sites On Test"}
                  </p>
                )}
              </div>
            </div>
            <div>
              <button type="button" onClick={() => setNote("Manual Patrol is not simulated in training.")} className="flex h-[92px] w-[152px] flex-col items-center justify-center gap-1.5 rounded-[3px] text-[15px] font-bold text-white" style={{ background: C.process }}>
                <Video aria-hidden className="size-8" /> MANUAL PATROL
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Event screen                                                        */
/* ------------------------------------------------------------------ */

const TABS = ["Alarms", "Current Events", "Previous Events", "Arming/Disarming", "Notes", "Problems", "Audit Event", "Maps", "Scripts"] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY: Partial<Record<Tab, string>> = { Notes: "notes", Maps: "map", Scripts: "scripts", "Previous Events": "previous", "Arming/Disarming": "arming", Alarms: "alarms", "Current Events": "current", Problems: "problems", "Audit Event": "audit" };

function EventScreen({ alert, view, scn, state, clock, now, send, operatorName }: { alert: Alert; view: RunView; scn: SimScenario; state: SimState; clock: number; now: Date; send: (a: SimAction) => boolean; operatorName: string }) {
  const site = scn.sites.find((s) => s.id === alert.siteId)!;
  const as = state.alerts[alert.id];
  const [tab, setTab] = useState<Tab>("Alarms");
  const [live, setLive] = useState(alert.cameraId);
  const [connecting, setConnecting] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "details" | "park" | "close" | "talkdown" | "note">(null);
  const [overlay, setOverlay] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const offSiteCams = useMemo(() => new Set(scn.alerts.filter((a) => Object.values(a.clips ?? {}).some((c) => c?.beats.some((b) => !b.onSite))).map((a) => a.cameraId)), [scn]);
  const ecareFailed = (cam: string) => scn.alerts.some((a) => a.type === "ECARE_FAILURE" && a.cameraId === cam && a.siteId === site.id && state.alerts[a.id]?.status !== "pending" && !state.alerts[a.id]?.reconnected);

  useEffect(() => {
    setConnecting(true);
    const t = setTimeout(() => setConnecting(false), 900);
    return () => clearTimeout(t);
  }, [live]);

  const openTab = (t: Tab) => {
    setTab(t);
    const k = TAB_KEY[t];
    if (k) send({ type: "TAB_VIEWED", alertId: alert.id, tab: k, at: clock });
  };
  const openMultiview = () => {
    const w = window.open(`/sim/${view.runId}/multiview`, `immix-multiview-${view.runId}`, "popup,width=1600,height=1000");
    if (!w) {
      // Pop-ups blocked: show MultiView inside this window instead.
      setOverlay(true);
      send({ type: "MULTIVIEW_OPEN", alertId: alert.id, at: clock });
    }
  };
  const talk = () => setModal("talkdown");
  const cams = site.cameras.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-1 flex-col">
      {note && <NotSimulated text={note} onClose={() => setNote(null)} />}
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-2">
        <ShieldCheck aria-hidden className="size-6 fill-[#4caf50] text-[#2e7d32]" />
        <h1 className="mr-auto text-[24px] font-semibold text-white">{site.name}</h1>
        <IxButton onClick={() => setNote("Raise is not simulated in training.")}>Raise</IxButton>
        <IxButton onClick={() => { setModal("details"); send({ type: "DETAILS_VIEWED", alertId: alert.id, at: clock }); }}>Details</IxButton>
        <IxButton onClick={openMultiview}>MultiView</IxButton>
        <IxButton onClick={() => setModal("park")}>Park Event</IxButton>
        <IxButton onClick={() => setModal("close")}>Close Event</IxButton>
        <button type="button" onClick={() => setNote("Help is not simulated in training.")} className="ml-1 text-[#cfcfcf] hover:text-white">
          <CircleHelp aria-hidden className="size-5" /><span className="sr-only">Help</span>
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,33.8fr)_minmax(0,3.3fr)_minmax(0,19.7fr)_minmax(0,3.3fr)_minmax(0,33.7fr)] px-[3.2%] pt-1">
        <EventClip alert={alert} site={site} view={view} clock={clock} send={send} offSite={offSiteCams.has(alert.cameraId)} />
        <span />
        <section aria-label="Cameras" className="flex h-[424px] flex-col border border-[#bdbdbd]" style={{ background: C.page }}>
          <p className="relative border-b border-[#bdbdbd] py-1.5 text-center" style={{ background: C.dark }}><Video aria-hidden className="absolute left-2 top-1.5 size-4" />Cameras</p>
          <div className="border-b border-[#bdbdbd] p-2">
            <input aria-label="Search cameras by name" placeholder="Search By Name" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border-2 border-[#bdbdbd] bg-[#343434] px-1 py-0.5 text-[13px] text-white placeholder:text-[#8e8e8e]" />
          </div>
          <ul className="flex-1 overflow-y-auto py-1">
            {cams.map((c) => (
              <li key={c.id} className="flex items-center">
                <button type="button" aria-pressed={live === c.id} onClick={() => { setLive(c.id); send({ type: "CAMERA_VIEWED", alertId: alert.id, cameraId: c.id, at: clock }); }} className={cn("flex-1 px-3 py-[4px] text-left text-[12.5px] tracking-[0.06em]", live === c.id ? "text-white underline" : "text-[#e8e8e8] hover:text-white")}>
                  {c.name}
                </button>
                <ExternalLink aria-hidden className="mr-6 size-3.5 text-[#cfcfcf]" />
              </li>
            ))}
          </ul>
          <button type="button" onClick={talk} className="relative border-t border-[#bdbdbd] py-1.5 text-center hover:bg-white/5" style={{ background: C.dark }}><Volume2 aria-hidden className="absolute left-2 top-1.5 size-4" />Audio</button>
          <button type="button" onClick={() => setNote("Edge Devices are not simulated in training.")} className="relative border-t border-[#bdbdbd] py-1.5 text-center hover:bg-white/5" style={{ background: C.dark }}><Settings aria-hidden className="absolute left-2 top-1.5 size-4" />Edge Devices</button>
        </section>
        <span />
        <section aria-label={`Live view ${live}`} className="flex h-[424px] flex-col border-[3px] bg-black" style={{ borderColor: C.blue }}>
          <div className="flex items-center justify-between px-1.5 py-0.5"><span className="text-[14px] font-bold text-white">{site.cameras.find((c) => c.id === live)?.name ?? live}</span>
            <span className="flex items-center gap-1.5 text-white"><ExternalLink aria-hidden className="size-4" /><Grid3x3 aria-hidden className="size-4" /><ImageIcon aria-hidden className="size-4" /><XCircle aria-hidden className="size-4 fill-[#e53935] text-white" /></span>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
            {connecting || ecareFailed(live) ? (
              <div className="absolute inset-0">
                <p className="bg-[#d4d4d4] px-1 py-1.5 text-[13px] font-semibold text-black">Connecting to device...</p>
                <Loader2 aria-hidden className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
              </div>
            ) : (
              <div className="h-full">
                <ImmixCamera media={view.media?.[live]} cameraLabel={site.cameras.find((c) => c.id === live)?.name ?? live} siteId={site.id} when={now} subject={subjectOnCamera(scn, state, live, clock)} offSiteCamera={offSiteCams.has(live)} title={`Live view ${live}`} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-1.5 py-1 text-white">
            <button type="button" onClick={talk} aria-label="Talk (audio)" className="text-[#00e000] hover:brightness-125"><Volume2 aria-hidden className="size-4" /></button>
            <Camera aria-hidden className="size-4" /><ZoomIn aria-hidden className="size-4" /><ZoomOut aria-hidden className="size-4" /><Recycle aria-hidden className="size-4" /><BarChart3 aria-hidden className="size-4 text-[#00e000]" /><AlignJustify aria-hidden className="size-4" />
            <span className="ml-auto border border-[#00e000] px-0.5 text-[12px] leading-tight text-[#00e000]">LIVE</span><Settings aria-hidden className="size-4" />
          </div>
        </section>
      </div>

      <div className="mx-2 mt-10 flex min-h-[340px] flex-1 flex-col border border-[#555]" style={{ background: C.body }}>
        <div role="tablist" aria-label="Event information" className="flex flex-wrap" style={{ background: C.tabbar }}>
          {TABS.map((t) => (
            <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => openTab(t)} className={cn("border-r border-black px-[13px] py-[7px] text-[13px] text-white", tab === t && "bg-[#505050]")}>
              {t === "Notes" ? `Notes (${site.notes.length + state.actions.filter((a) => a.type === "ADD_NOTE").length})` : t}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="flex-1 overflow-auto p-4">
          <TabContent tab={tab} alert={alert} as={as} site={site} state={state} startLocal={view.scenario.startLocal} operatorName={operatorName} onSetOutcome={() => setModal("close")} onAck={() => send({ type: "ACK_ALARMS", alertId: alert.id, at: clock })} onAddNote={() => setModal("note")} />
        </div>
      </div>

      {overlay && (
        <div role="dialog" aria-modal="true" aria-label="MultiView" className="fixed inset-0 z-50 overflow-auto bg-[#1f1f1f] p-2">
          <div className="mb-2 flex justify-end"><IxButton onClick={() => { setOverlay(false); send({ type: "MULTIVIEW_CLOSE", alertId: alert.id, at: clock }); }} autoFocus>Close MultiView</IxButton></div>
          <MultiviewGrid site={site} scn={scn} state={state} clock={clock} now={now} media={view.media} offSiteCams={offSiteCams} ecareFailed={ecareFailed} />
        </div>
      )}
      {modal === "details" && <DetailsModal site={site} onClose={() => setModal(null)} onCall={(c) => send({ type: "CALL_START", alertId: alert.id, contactId: c, at: clock })} />}
      {modal === "park" && <ParkModal onClose={() => setModal(null)} onPark={(minutes, n) => { if (send({ type: "PARK", alertId: alert.id, minutes, note: n, at: clock })) setModal(null); }} />}
      {modal === "close" && <CloseModal outcomes={view.outcomes} onClose={() => setModal(null)} onSubmit={(outcome, n) => { if (send({ type: "CLOSE", alertId: alert.id, outcome, note: n, at: clock })) setModal(null); }} />}
      {modal === "note" && <NoteModal onClose={() => setModal(null)} onSave={(n, from, to) => { if (send({ type: "ADD_NOTE", alertId: alert.id, note: n, validFrom: from || undefined, validTo: to || undefined, at: clock })) setModal(null); }} />}
      {modal === "talkdown" && (
        <TalkdownModal
          site={site}
          speakers={site.cameras.filter((c) => /speaker/i.test(c.name)).length ? site.cameras.filter((c) => /speaker/i.test(c.name)) : site.cameras}
          defaultTalkdown={view.defaultTalkdown}
          onClose={() => setModal(null)}
          onSpeak={(cameraId, script, used) => { if (send({ type: "PLAY_TALKDOWN", alertId: alert.id, cameraId, script, usedSiteScript: used, at: clock })) setModal(null); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Event clip — only continuous 1.00x playback counts as review        */
/* ------------------------------------------------------------------ */

function EventClip({ alert, site, view, clock, send, offSite }: { alert: Alert; site: Site; view: RunView; clock: number; send: (a: SimAction) => boolean; offSite: boolean }) {
  const phases = (["pre", "post"] as const).filter((p) => alert.clips?.[p]);
  const [phase, setPhase] = useState<"pre" | "post">(phases[0] ?? "pre");
  const clip = alert.clips?.[phase];
  const [loading, setLoading] = useState(true);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const seg = useRef<{ from: number; rate: number } | null>(null);
  const tRef = useRef(0);
  tRef.current = t;
  const clockRef = useRef(clock);
  clockRef.current = clock;

  useEffect(() => {
    const x = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(x);
  }, []);

  const endSegment = useCallback(() => {
    if (seg.current && tRef.current > seg.current.from + 0.2) {
      send({ type: "CLIP_SEGMENT", alertId: alert.id, phase, from: seg.current.from, to: tRef.current, rate: seg.current.rate, at: clockRef.current });
    }
    seg.current = null;
  }, [alert.id, phase, send]);

  useEffect(() => {
    if (!playing || !clip) return;
    let last = performance.now();
    let raf = 0;
    const step = (n: number) => {
      const next = tRef.current + ((n - last) / 1000) * rate;
      last = n;
      if (next >= clip.lengthSec) {
        tRef.current = clip.lengthSec;
        setT(clip.lengthSec);
        endSegment();
        setPlaying(false);
        return;
      }
      setT(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, rate, clip, endSegment]);
  useEffect(() => () => endSegment(), [endSegment]);

  const play = () => {
    if (!clip) return;
    if (t >= clip.lengthSec) { setT(0); tRef.current = 0; }
    seg.current = { from: tRef.current, rate };
    setPlaying(true);
  };
  const pause = () => { endSegment(); setPlaying(false); };
  const changeRate = (r: number) => { if (playing) { endSegment(); seg.current = { from: tRef.current, rate: r }; } setRate(r); };
  const seek = (v: number) => { if (playing) endSegment(); setT(v); tRef.current = v; if (playing) seg.current = { from: v, rate }; };
  const pick = (p: "pre" | "post") => { pause(); setPhase(p); setT(0); tRef.current = 0; };

  const beat = clip ? clip.beats.find((b) => t >= b.fromSec && t <= b.toSec) ?? clip.beats.at(-1)! : null;
  const k = beat && beat.toSec > beat.fromSec ? (t - beat.fromSec) / (beat.toSec - beat.fromSec) : 0;
  const subject = beat?.subject ? { x: beat.x0 + (beat.x1 - beat.x0) * Math.min(1, Math.max(0, k)), onSite: beat.onSite ?? false, label: beat.label } : null;
  const clipStart = alert.atMin * 60 + (phase === "pre" ? -(clip?.lengthSec ?? 0) : 0);
  const camName = site.cameras.find((c) => c.id === alert.cameraId)?.name ?? alert.cameraId;

  return (
    <div>
      <section aria-label="Event clip" className="flex h-[424px] flex-col border-[3px] bg-black" style={{ borderColor: C.red }}>
        <div className="flex items-center gap-2 bg-black p-1">
          <select aria-label="Select event clip" value={phase} onChange={(e) => pick(e.target.value as "pre" | "post")} disabled={!clip} className="h-[20px] flex-1 border border-[#555] bg-black text-[12px] text-white">
            {phases.length === 0 && <option value="pre"></option>}
            {phases.map((p) => <option key={p} value={p}>{p === "pre" ? "Pre-Alarm" : "Post-Alarm"} — {camName} ({mmss(alert.clips![p]!.lengthSec)})</option>)}
          </select>
          <ExternalLink aria-hidden className="size-4 text-white" />
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          {!clip || loading ? (
            <p className="text-[32px] font-bold text-white">{!clip ? "No Footage Available" : "Waiting For Footage..."}</p>
          ) : (
            <div className="h-full">
              <ImmixCamera media={view.media?.[alert.cameraId]} cameraLabel={camName} siteId={site.id} when={wall(view.scenario.startLocal, clipStart + t)} subject={subject} offSiteCamera={offSite} title={`Event clip, ${phase === "pre" ? "pre-alarm" : "post-alarm"}`} />
            </div>
          )}
          <p className="sr-only" aria-live="polite">{!playing && beat ? beat.label : ""}</p>
        </div>
        <div className="flex items-center gap-2 border-t border-[#333] bg-black px-1.5 py-1 text-[#d0d0d0]">
          <Camera aria-hidden className="size-4" /><Download aria-hidden className="size-4" />
          <button type="button" onClick={playing ? pause : play} disabled={!clip || loading} aria-label={playing ? "Pause clip" : "Play clip"} className="disabled:opacity-40">
            {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          </button>
          <button type="button" onClick={() => changeRate(Math.max(0.5, rate / 2))} aria-label="Slower" disabled={!clip}><Minus aria-hidden className="size-4" /></button>
          <span className={cn("w-10 text-center text-[12px]", rate !== 1 && "text-[#f5b847]")}>{rate.toFixed(2)}x</span>
          <button type="button" onClick={() => changeRate(Math.min(2, rate * 2))} aria-label="Faster" disabled={!clip}><Plus aria-hidden className="size-4" /></button>
          <input type="range" min={0} max={clip?.lengthSec ?? 0} step={0.1} value={t} disabled={!clip} onChange={(e) => seek(Number(e.target.value))} aria-label="Clip position" className="h-1 flex-1 accent-[#9e9e9e]" />
          <span className="text-[12px]">{mmss(t)}/{mmss(clip?.lengthSec ?? 0)}</span>
          <AlignJustify aria-hidden className="size-4" />
        </div>
      </section>
      <p className="mt-1.5 border border-[#9e9e9e] py-0.5 text-center text-[13px]" style={{ background: C.dark }} title={alert.details}>Event Details</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom tabs                                                         */
/* ------------------------------------------------------------------ */

function GridTable({ head, rows, caption }: { head: string[]; rows: React.ReactNode[][]; caption: string }) {
  return (
    <table className="w-full border border-[#555] text-left text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-[14px] font-bold text-white" style={{ background: C.hdr }}>
        <tr>{head.map((h, i) => <th key={i} scope="col" className="border-r border-[#555] px-1.5 py-1">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={cn("border-t border-[#555]", i % 2 ? "bg-[#454545]" : "bg-[#3c3c3c]")}>
            {r.map((c, j) => <td key={j} className="px-1.5 py-1.5 align-top">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabContent({ tab, alert, as, site, state, startLocal, operatorName, onSetOutcome, onAck, onAddNote }: { tab: Tab; alert: Alert; as: SimState["alerts"][string]; site: Site; state: SimState; startLocal: string; operatorName: string; onSetOutcome: () => void; onAck: () => void; onAddNote: () => void }) {
  // Site time equals operator time unless a scenario defines a site time zone (none do yet).
  const siteTime = (d: Date) => immixDate(d);
  switch (tab) {
    case "Alarms": {
      const rows: React.ReactNode[][] = [];
      if (as.reconnected) {
        const d = wall(startLocal, (alert.reconnectAtMin ?? 0) * 60);
        rows.push([immixDate(d), siteTime(d), <span key="p" className="block text-right">0</span>, `Ecare successfully reconnected to '${alert.cameraId}'`, "", <button key="o" type="button" onClick={onSetOutcome} className="text-[#3fa9f5] hover:underline">Set Outcome</button>]);
      }
      const d = wall(startLocal, alert.atMin * 60);
      rows.push([immixDate(d), siteTime(d), <span key="p" className="block text-right">{alert.type === "ECARE_FAILURE" ? 0 : 600}</span>, alert.details, alert.type === "ECARE_FAILURE" ? "" : alert.cameraId, <button key="o" type="button" onClick={onSetOutcome} className="text-[#3fa9f5] hover:underline">Set Outcome</button>]);
      return (
        <div>
          <IxButton onClick={onAck} className="mb-1.5">Acknowledge All Alarms</IxButton>
          <GridTable caption="Alarms" head={["Time", "Site Time", "Priority", "Details", "Linked Camera", "Outcome"]} rows={rows} />
        </div>
      );
    }
    case "Current Events": {
      const entries: { at: number; text: string }[] = [{ at: alert.atMin * 60, text: alert.details }];
      for (const a of state.actions) {
        if (!("alertId" in a) || a.alertId !== alert.id) continue;
        const map: Partial<Record<SimAction["type"], string>> = {
          OPEN_ALERT: `Started Processing by ${operatorName}`, DETAILS_VIEWED: "Details Viewed.", MULTIVIEW_OPEN: "MultiView Opened.", MULTIVIEW_CLOSE: "MultiView Closed.",
          ACK_ALARMS: `Alarm acknowledged : ${alert.details}`,
        };
        let text = map[a.type];
        if (a.type === "CAMERA_VIEWED") text = `Camera Viewed ${a.cameraId}`;
        if (a.type === "PLAY_TALKDOWN") text = `Audio played on ${a.cameraId}`;
        if (a.type === "CALL_START") text = "Call started from call list.";
        if (a.type === "PARK") text = `Event Parked for ${a.minutes} minute(s).${a.note ? ` Note: ${a.note}` : ""}`;
        if (a.type === "ADD_NOTE") text = `Note added: ${a.note}`;
        if (text) entries.push({ at: a.at, text });
      }
      entries.sort((x, y) => y.at - x.at);
      return <GridTable caption="Current events" head={["Time", "Site Time", "Details"]} rows={entries.map((e) => { const d = wall(startLocal, e.at); return [immixDate(d), siteTime(d), e.text]; })} />;
    }
    case "Previous Events": {
      const ev = site.previousEvents ?? [];
      return ev.length ? (
        <div className="border border-[#777] p-2">
          <p className="font-bold">Previous events ({ev.length})</p>
          <div className="mt-1 pl-4">
            <GridTable caption="Previous events" head={["Site Time", "Event Title", "Notes", "Hide from users", "Preserve Event"]} rows={ev.map((e) => [e.at, e.summary, "", "Hide", "Preserve"])} />
          </div>
        </div>
      ) : <p>No previous events.</p>;
    }
    case "Arming/Disarming":
      return <GridTable caption="Arming schedule" head={["Schedule"]} rows={[[site.armingSchedule ?? "No arming schedule on file."]]} />;
    case "Notes": {
      const added = state.actions.filter((a): a is Extract<SimAction, { type: "ADD_NOTE" }> => a.type === "ADD_NOTE");
      const rows: React.ReactNode[][] = [
        ...site.notes.map((n) => ["—", "Account setup", "", n, <span key="i" className="flex justify-end gap-1"><Pencil aria-hidden className="size-3.5 text-[#e8c34a]" /><X aria-hidden className="size-3.5 text-[#e53935]" /></span>]),
        ...added.map((a) => [immixDate(wall(startLocal, a.at)), operatorName, a.validFrom || a.validTo ? `${a.validFrom ?? ""} – ${a.validTo ?? ""}` : "", a.note, ""]),
      ];
      return (
        <div>
          <div className="mb-1 flex justify-end"><button type="button" onClick={onAddNote} className="inline-flex items-center gap-1 text-[13px] text-white hover:underline"><PlusCircle aria-hidden className="size-4 fill-[#43a047] text-white" /> Add new note</button></div>
          <GridTable caption="Site notes" head={["Created", "Created By", "Valid Between", "Note", ""]} rows={rows} />
        </div>
      );
    }
    case "Maps":
      return <MapsTab site={site} />;
    case "Scripts":
      return site.talkdownScript ? <GridTable caption="Scripts" head={["Script"]} rows={[[site.talkdownScript]]} /> : <p>No site-specific script on file.</p>;
    case "Problems":
      return <GridTable caption="Problems" head={["Time", "Problem", "Status"]} rows={[]} />;
    case "Audit Event":
      return <p className="text-[#cfcfcf]">Audit Event is not simulated in training.</p>;
  }
}

function MapsTab({ site }: { site: Site }) {
  return (
    <div className="-m-4 flex flex-col">
      <div className="flex items-center justify-between bg-[#3c3c3c] px-2 py-1.5"><span className="text-[13px] font-bold tracking-[0.12em]">GOOGLE MAP</span><span className="text-[13px]">Filter Types ▾</span></div>
      <div className="grid min-h-[300px] grid-cols-[200px_1fr]">
        <div className="bg-[#282828] p-2"><span className="font-bold underline">Google Map</span></div>
        <div className="relative overflow-hidden bg-[#e8f0e2]">
          <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
            <rect width="800" height="300" fill="#e6efe1" />
            <path d="M0 60 C200 20 420 120 800 40" stroke="#b9c9e8" strokeWidth="26" fill="none" />
            <path d="M0 60 C200 20 420 120 800 40" stroke="#9db6e0" strokeWidth="2" fill="none" />
            <path d="M120 300 L260 0 M520 300 L640 0 M0 200 L800 230" stroke="#ffffff" strokeWidth="9" />
            <rect x="330" y="120" width="170" height="110" fill="#d7e6cd" stroke="#e8c34a" strokeDasharray="8 5" strokeWidth="2.5" />
            <circle cx="300" cy="190" r="8" fill="#4285f4" opacity="0.8" /><circle cx="560" cy="160" r="8" fill="#4285f4" opacity="0.8" />
          </svg>
          <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-full text-[#ea4335]" aria-hidden>
            <svg width="26" height="38" viewBox="0 0 26 38"><path d="M13 0C6 0 0 6 0 13c0 10 13 25 13 25s13-15 13-25C26 6 20 0 13 0z" fill="#ea4335" /><circle cx="13" cy="13" r="5" fill="#a52714" /></svg>
          </div>
          <div className="absolute left-2 top-2 max-w-sm rounded bg-white p-3 text-[#202124] shadow">
            <p className="text-[16px]">{site.address.split(",")[0]}</p>
            <p className="text-[12px] text-[#5f6368]">{site.address}</p>
          </div>
          {site.boundary && <p className="absolute bottom-2 left-2 right-2 rounded bg-black/70 p-2 text-[12px] text-white">Property boundary: {site.boundary}</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MultiView grid (shared with the MultiView window)                   */
/* ------------------------------------------------------------------ */

export function MultiviewGrid({ site, scn, state, clock, now, media, offSiteCams, ecareFailed }: { site: Site; scn: SimScenario; state: SimState; clock: number; now: Date; media: RunView["media"]; offSiteCams: Set<string>; ecareFailed: (c: string) => boolean }) {
  return (
    <div className="grid grid-cols-2 border-l border-t border-[#2a6f9e] lg:grid-cols-4">
      {site.cameras.map((c) => (
        <div key={c.id} className="flex flex-col border-b border-r border-[#2a6f9e] bg-black">
          <p className="px-1 py-0.5 text-[12px] font-bold text-white">{c.name}</p>
          <div className="flex aspect-[3/1.05] items-center justify-center bg-black">
            {ecareFailed(c.id) ? (
              <p className="text-[11px] text-white">Connecting to device...</p>
            ) : (
              <div className="h-full"><ImmixCamera media={media?.[c.id]} cameraLabel={c.name} siteId={site.id} when={now} subject={subjectOnCamera(scn, state, c.id, clock)} offSiteCamera={offSiteCams.has(c.id)} title={`MultiView ${c.name}`} compact /></div>
            )}
          </div>
          <div className="flex items-center gap-2 px-1 py-1 text-white">
            <Volume2 aria-hidden className="size-3.5 text-[#00e000]" /><Camera aria-hidden className="size-3.5" /><ZoomIn aria-hidden className="size-3.5" /><ZoomOut aria-hidden className="size-3.5" /><Recycle aria-hidden className="size-3.5" /><BarChart3 aria-hidden className="size-3.5" /><AlignJustify aria-hidden className="size-3.5" /><Settings aria-hidden className="ml-auto size-3.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialogs (IMMIX style)                                               */
/* ------------------------------------------------------------------ */

function Modal({ title, onClose, children, width = 506 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full border border-[#555] shadow-2xl" style={{ maxWidth: width, background: C.page }}>
        <div className="flex items-center justify-between bg-[#1f1f1f] px-3 py-2">
          <h2 className="text-[13px] font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-white"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
const ixField = "w-full rounded-[6px] border-2 border-[#d0d0d0] bg-[#343434] px-2 py-0.5 text-[12px] text-white";
const ixArea = "w-full border border-[#777] bg-[#343434] p-2 text-[13px] text-white";
function Footer({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-1.5 border-t border-[#555] px-3 py-3">{children}</div>;
}

function CloseModal({ outcomes, onClose, onSubmit }: { outcomes: string[]; onClose: () => void; onSubmit: (outcome: string, note: string) => void }) {
  const [outcome, setOutcome] = useState("");
  const [sub, setSub] = useState("");
  const [note, setNote] = useState("");
  const subs = SUB_OUTCOMES[outcome];
  return (
    <Modal title="Close Event" onClose={onClose}>
      <div className="p-3 text-[12px]">
        <label className="block font-bold text-white"><span className="block">Outcome :</span>
          <select aria-label="Outcome" value={outcome} onChange={(e) => { setOutcome(e.target.value); setSub(""); }} className={cn(ixField, "mt-1 max-w-[298px]")}>
            <option value="">Select Outcome</option>
            {outcomes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        {subs && (
          <select aria-label="Sub-outcome" value={sub} onChange={(e) => setSub(e.target.value)} className={cn(ixField, "mt-1.5 max-w-[192px]")}>
            <option value="">Select Outcome</option>
            {subs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <textarea aria-label="Note" value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} rows={7} className={cn(ixArea, "mt-3")} />
        <p className="font-bold text-white">{note.length} / 5000</p>
      </div>
      <Footer>
        <IxButton disabled={!outcome || (!!subs && !sub)} onClick={() => onSubmit(outcome, sub ? `${sub}. ${note}` : note)}>Ok</IxButton>
        <IxButton onClick={onClose}>Cancel</IxButton>
      </Footer>
    </Modal>
  );
}

function ParkModal({ onClose, onPark }: { onClose: () => void; onPark: (minutes: number, note: string) => void }) {
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [note, setNote] = useState("");
  const minutes = (Number(h) || 0) * 60 + (Number(m) || 0);
  return (
    <Modal title="Park Event" onClose={onClose} width={306}>
      <div className="p-3 text-[12px] text-white">
        <p>Park for</p>
        <div className="mt-2 flex items-center gap-1.5">
          <input aria-label="Hours" inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} className="w-8 rounded-[3px] border-2 border-[#d0d0d0] bg-[#343434] px-1" /> hours,
          <input aria-label="Minutes" inputMode="numeric" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, ""))} className="w-8 border border-[#777] bg-[#343434] px-1" /> minutes.
        </div>
        <label className="mt-3 block">Note:<textarea aria-label="Park note" value={note} maxLength={250} onChange={(e) => setNote(e.target.value)} rows={6} className={cn(ixArea, "mt-2")} /></label>
        <p className="font-bold">{note.length} / 250</p>
      </div>
      <Footer>
        <IxButton disabled={minutes <= 0} onClick={() => onPark(minutes, note)}>Ok</IxButton>
        <IxButton onClick={onClose}>Cancel</IxButton>
      </Footer>
    </Modal>
  );
}

function NoteModal({ onClose, onSave }: { onClose: () => void; onSave: (note: string, from: string, to: string) => void }) {
  const [note, setNote] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <Modal title="Add new note" onClose={onClose}>
      <div className="grid gap-2 p-3 text-[12px] text-white">
        <div className="flex flex-wrap items-center gap-2">Valid between
          <input aria-label="Valid from" placeholder="HH:MM" value={from} onChange={(e) => setFrom(e.target.value)} className="w-20 border border-[#777] bg-[#343434] px-1" /> and
          <input aria-label="Valid to" placeholder="HH:MM" value={to} onChange={(e) => setTo(e.target.value)} className="w-20 border border-[#777] bg-[#343434] px-1" />
        </div>
        <textarea aria-label="Note text" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} rows={5} className={ixArea} />
      </div>
      <Footer>
        <IxButton disabled={!note.trim()} onClick={() => onSave(note, from, to)}>Ok</IxButton>
        <IxButton onClick={onClose}>Cancel</IxButton>
      </Footer>
    </Modal>
  );
}

function DetailsModal({ site, onClose, onCall }: { site: Site; onClose: () => void; onCall: (id: string) => void }) {
  const [called, setCalled] = useState<string | null>(null);
  return (
    <Modal title="Details" onClose={onClose} width={620}>
      <div className="p-3 text-[13px] text-white">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="font-bold">Site</dt><dd>{site.name}</dd>
          <dt className="font-bold">Account</dt><dd>{site.accountId}</dd>
          <dt className="font-bold">Address</dt><dd>{site.address}</dd>
          <dt className="font-bold">Phone</dt><dd>{site.phone}</dd>
        </dl>
        <p className="mt-3 font-bold">Contacts</p>
        <GridTable caption="Call list" head={["Name", "Role", "Phone", ""]} rows={site.callList.map((c) => [c.name, c.role, c.phone, <IxButton key="c" onClick={() => { onCall(c.id); setCalled(c.name); }}>Call</IxButton>])} />
        {called && <p role="status" className="mt-2 rounded bg-[#0b2a4d] px-3 py-2 text-xs">Call to {called} recorded. Phone calls are simulated on Computer 2 (Dialpad), not built yet.</p>}
        <p className="mt-3 text-[11px] text-[#cfcfcf]">Training note: no reference screenshot of the live Details window exists yet; this layout is approximate.</p>
      </div>
      <Footer><IxButton onClick={onClose}>Close</IxButton></Footer>
    </Modal>
  );
}

function TalkdownModal({ site, speakers, defaultTalkdown, onClose, onSpeak }: { site: Site; speakers: { id: string; name: string }[]; defaultTalkdown: string | null; onClose: () => void; onSpeak: (cameraId: string, script: string, usedSiteScript: boolean) => void }) {
  const [cam, setCam] = useState(speakers[0]?.id ?? "");
  const [source, setSource] = useState<"site" | "default" | "">(site.talkdownScript ? "site" : defaultTalkdown ? "default" : "");
  const [text, setText] = useState(site.talkdownScript ?? defaultTalkdown ?? "");
  const pickSrc = (s: "site" | "default") => { setSource(s); setText(s === "site" ? site.talkdownScript ?? "" : defaultTalkdown ?? ""); };
  const unfilled = /\[[^\]]*\]/.test(text);
  return (
    <Modal title="Audio" onClose={onClose} width={560}>
      <div className="grid gap-3 p-3 text-[12px] text-white">
        <label className="block font-bold"><span className="block">Speaker :</span>
          <select aria-label="Speaker" value={cam} onChange={(e) => setCam(e.target.value)} className={cn(ixField, "mt-1 max-w-[298px]")}>
            {speakers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5">
          <IxButton aria-pressed={source === "site"} disabled={!site.talkdownScript} onClick={() => pickSrc("site")} className={source === "site" ? "ring-2 ring-[#3fa9f5]" : ""}>Site script{site.talkdownScript ? "" : " (none on file)"}</IxButton>
          {defaultTalkdown && <IxButton aria-pressed={source === "default"} onClick={() => pickSrc("default")} className={source === "default" ? "ring-2 ring-[#3fa9f5]" : ""}>Titan default script</IxButton>}
        </div>
        <label className="block">What you will say{source === "default" ? " — replace every [bracketed] part" : ""}:
          <textarea aria-label="Talk-down script" value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={1000} className={cn(ixArea, "mt-1")} />
        </label>
        {unfilled && <p className="text-[#f5b847]">Fill in the [bracketed] parts before speaking.</p>}
        <p className="text-[11px] text-[#cfcfcf]">On the live system you speak into the microphone. In training, type exactly what you would say.</p>
      </div>
      <Footer>
        <IxButton disabled={!cam || !text.trim() || unfilled} onClick={() => onSpeak(cam, text, source === "site")}>Speak</IxButton>
        <IxButton onClick={onClose}>Cancel</IxButton>
      </Footer>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Results (Academy styling)                                           */
/* ------------------------------------------------------------------ */

function SimResults({ view }: { view: RunView }) {
  const r = view.result!;
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <p className="titan-eyebrow">Simulator result · {view.scenario.fictional ? "fictional practice" : `scenario ${view.scenario.id}`} · {view.mode}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">{view.scenario.title}</h1>
      <section className="titan-panel mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center" data-edge="true">
        <div className={cn("grid size-16 shrink-0 place-items-center rounded-2xl", r.passed ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
          {r.passed ? <CheckCircle2 aria-hidden className="size-8" /> : <XCircle aria-hidden className="size-8" />}
        </div>
        <div className="flex-1">
          <p className="text-xl font-semibold text-fg">{r.passed ? "Passed" : "Not passed"}</p>
          <p className="text-fg-muted">Score <strong className="text-fg">{r.scorePercent}%</strong> ({r.earned}/{r.possible} points) · Critical misses <strong className="text-fg">{r.criticalFailures}</strong> · Required 90% with no critical misses.</p>
        </div>
      </section>
      <section className="titan-panel mt-6 p-6" aria-labelledby="crit-h">
        <h2 id="crit-h" className="text-lg font-semibold text-fg">What was checked</h2>
        <ul className="mt-3 grid gap-2">
          {r.criteria.map((c) => (
            <li key={c.id} className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-sm">
              {!c.supported ? <CircleHelp aria-label="Not evaluated" className="mt-0.5 size-5 shrink-0 text-fg-subtle" /> : c.passed ? <CheckCircle2 aria-label="Passed" className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle aria-label="Missed" className="mt-0.5 size-5 shrink-0 text-danger" />}
              <span className="flex-1 text-fg">{c.label}</span>
              {c.critical && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs text-danger">critical</span>}
              {!c.supported && <span className="text-xs text-fg-subtle">Not evaluated — needs Computer 2</span>}
              <span className="font-mono text-xs text-fg-subtle">{c.weight} pt</span>
            </li>
          ))}
        </ul>
      </section>
      {r.errors.length > 0 && (
        <section className="titan-panel mt-6 p-6" aria-labelledby="err-h">
          <h2 id="err-h" className="text-lg font-semibold text-fg">Procedural errors</h2>
          <ul className="mt-3 grid gap-2 text-sm">{r.errors.map((e, i) => <li key={i} className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-2 text-fg">{e.message}</li>)}</ul>
        </section>
      )}
      <section className="titan-panel mt-6 p-6" aria-labelledby="why-h">
        <h2 id="why-h" className="text-lg font-semibold text-fg">The correct handling</h2>
        <ul className="mt-3 grid gap-3 text-sm">
          {r.rationale.map((x) => (
            <li key={x.alertId} className="rounded-xl bg-surface-2 p-4">
              <p className="font-medium text-fg">Alert {x.alertId} · accepted outcome: {x.accepted.join(" or ")}</p>
              <p className="mt-1 text-fg-muted">{x.text}</p>
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-6 flex flex-wrap gap-3">
        {view.moduleKey && <Link href={`/academy/${view.moduleKey}`} className="inline-flex h-12 items-center rounded-xl bg-accent px-6 font-medium text-accent-fg">Return to the module</Link>}
        <Link href="/simulator" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line-strong px-6 font-medium text-fg"><LogOut aria-hidden className="size-4" /> Simulator home</Link>
      </div>
    </main>
  );
}

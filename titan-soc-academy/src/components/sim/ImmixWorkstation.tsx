"use client";
/**
 * Simulated IMMIX workstation (Computer 1). Layout follows the IMMIX event
 * screen: alarm queue → event with event clip, cameras/audio, live view and
 * site tabs; Details, MultiView, Park Event and Close Event.
 *
 * Every operator action is recorded and sent to the server, which keeps the
 * authoritative run and scores it. Answer keys never reach this component.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BellRing, CheckCircle2, ChevronLeft, CircleHelp, Clock3, FastForward, Grid2x2, ListChecks, Loader2, LogOut, Megaphone, Minus, Pause, Phone, Play, Plus,
  ShieldAlert, X, XCircle,
} from "lucide-react";
import { applyAction, SimError, subjectOnCamera, tick } from "@/lib/sim/engine";
import type { SimAction, SimScenario, SimState } from "@/lib/sim/types";
import { finishSimRun, sendSimActions } from "@/lib/sim/actions";
import type { RunView } from "@/lib/sim/service";
import { sceneFor, SimCamera } from "./SimCamera";
import { cn } from "@/lib/cn";

type Alert = RunView["scenario"]["alerts"][number];

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

/* ------------------------------------------------------------------ */

export function ImmixWorkstation({ initial }: { initial: RunView }) {
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

  const scn = view.scenario as unknown as SimScenario;
  const cfg = useMemo(() => ({ outcomes: view.outcomes, defaultTalkdown: view.defaultTalkdown }), [view.outcomes, view.defaultTalkdown]);
  const done = view.status === "COMPLETED";

  // Live clock (1x real time).
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
        next = applyAction(scn, cfg, local, action);
      } catch (e) {
        if (e instanceof SimError) setToast({ tone: "error", text: e.message });
        return false;
      }
      setLocal(next);
      if (action.type === "ADVANCE_TIME") base.current = { clock: next.clock, t0: Date.now() };
      inFlight.current += 1;
      setPending((p) => p + 1);
      const job = queue.current.then(async () => {
        try {
          const r = await sendSimActions(view.runId, [action]);
          inFlight.current -= 1;
          if (r.view) {
            setView(r.view);
            // Server state is authoritative once nothing else is in flight.
            if (inFlight.current === 0) setLocal(r.view.state as unknown as SimState);
          }
          if (!r.ok) setToast({ tone: "error", text: r.error });
          else {
            const before = new Set(local.errors.map((e) => `${e.code}${e.at}`));
            const fresh = r.view.state.errors.find((e) => !before.has(`${e.code}${e.at}`));
            if (fresh) setToast({ tone: "error", text: fresh.message });
          }
        } catch {
          inFlight.current -= 1;
          setToast({ tone: "error", text: "Connection problem — your last actions may not be saved. Check your connection." });
        } finally {
          setPending((p) => p - 1);
        }
      });
      queue.current = job.catch(() => {});
      return true;
    },
    [scn, cfg, local, view.runId],
  );

  // Announce arriving alerts and reconnects.
  const prevStatuses = useRef(JSON.stringify(Object.fromEntries(Object.entries(display.alerts).map(([k, v]) => [k, [v.status, v.reconnected]]))));
  useEffect(() => {
    const cur = Object.fromEntries(Object.entries(display.alerts).map(([k, v]) => [k, [v.status, v.reconnected]]));
    const prev = JSON.parse(prevStatuses.current) as Record<string, [string, boolean]>;
    for (const [k, [st, rc]] of Object.entries(cur)) {
      if (prev[k]?.[0] === "pending" && st === "queued") setToast({ tone: "info", text: "New alarm in the queue." });
      if (!prev[k]?.[1] && rc) setToast({ tone: "info", text: "E-CARE status changed — check the parked event." });
      if (prev[k]?.[0] === "parked" && st === "queued" && !rc) setToast({ tone: "info", text: "A parked event returned to the queue." });
    }
    prevStatuses.current = JSON.stringify(cur);
  }, [display.alerts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const openAlert = scn.alerts.find((a) => display.alerts[a.id]?.status === "open") as Alert | undefined;
  const now = wall(view.scenario.startLocal, clock);
  const unanswered = scn.alerts.filter((a) => display.alerts[a.id]?.status === "queued").length;

  const finish = async () => {
    const openCount = scn.alerts.filter((a) => display.alerts[a.id]?.status !== "closed" && display.alerts[a.id]?.status !== "pending").length;
    if (openCount && !window.confirm(`${openCount} alert(s) are not closed. Finish and score this run anyway?`)) return;
    setFinishing(true);
    await queue.current;
    const r = await finishSimRun(view.runId);
    setFinishing(false);
    if (r.view) setView(r.view);
    if (!r.ok) setToast({ tone: "error", text: r.error });
    window.scrollTo({ top: 0 });
  };

  if (done && view.result) return <SimResults view={view} />;

  return (
    <div className="flex min-h-dvh flex-col bg-[#2b2d30] text-[#e6e6e6]">
      {/* Training bar (Titan Academy, not part of IMMIX) */}
      <div className="flex flex-wrap items-center gap-3 border-b border-black/40 bg-[#0b1220] px-4 py-2 text-sm text-[#e7ecf4]">
        <Link href={view.moduleKey ? `/academy/${view.moduleKey}` : "/simulator"} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[#a6b1c4] hover:bg-white/10 hover:text-white">
          <ChevronLeft aria-hidden className="size-4" /> Exit
        </Link>
        <span className="rounded-md border border-dashed border-white/30 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-[#a6b1c4]">
          Simulation · {view.scenario.fictional ? "fictional practice" : `scenario ${view.scenario.id}`} · {view.mode}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{view.scenario.title}</span>
        <span className="inline-flex items-center gap-1.5 font-mono" aria-label="Simulated time">
          <Clock3 aria-hidden className="size-4 text-[#7eacff]" /> {clockText(now)}
        </span>
        {view.nextEvent !== null && (
          <button
            type="button"
            onClick={() => send({ type: "ADVANCE_TIME", seconds: Math.max(1, Math.ceil(view.nextEvent! - (clock - local.clock))), at: clock })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10"
            title="Skip simulated time to the next scheduled event"
          >
            <FastForward aria-hidden className="size-3.5" /> Skip ahead
          </button>
        )}
        {view.tasks && (
          <button type="button" onClick={() => setShowTasks((v) => !v)} aria-pressed={showTasks} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10">
            <ListChecks aria-hidden className="size-3.5" /> Tasks
          </button>
        )}
        <span className="inline-flex w-5 justify-center">{pending > 0 && <Loader2 aria-label="Saving" className="size-4 animate-spin text-[#a6b1c4]" />}</span>
        <button type="button" onClick={finish} disabled={finishing} className="rounded-lg bg-[#4f8fff] px-3 py-1.5 text-xs font-semibold text-[#03101f] hover:bg-[#7eacff] disabled:opacity-60">
          {finishing ? "Scoring…" : "Finish & score"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {openAlert ? (
            <EventScreen key={openAlert.id} alert={openAlert} view={view} scn={scn} state={display} clock={clock} now={now} send={send} />
          ) : (
            <QueueScreen view={view} scn={scn} state={display} clock={clock} send={send} />
          )}
          <div className="border-t border-black/40 bg-[#1f2023] py-1 text-center text-xs font-semibold" aria-live="polite">
            Current Queue Status: {unanswered} unanswered alarm{unanswered === 1 ? "" : "s"}.
          </div>
        </div>
        {view.tasks && showTasks && <TaskPanel view={view} />}
      </div>

      {toast && (
        <div role={toast.tone === "error" ? "alert" : "status"} className={cn("fixed bottom-6 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-2xl", toast.tone === "error" ? "bg-[#5c1d1a] text-white" : "bg-[#0b2a4d] text-white")}>
          {toast.tone === "error" ? <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> : <BellRing aria-hidden className="mt-0.5 size-4 shrink-0" />}
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="ml-2 opacity-70 hover:opacity-100"><X className="size-4" /></button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tasks (guided / practice)                                           */
/* ------------------------------------------------------------------ */

function TaskPanel({ view }: { view: RunView }) {
  return (
    <aside aria-label="Scenario tasks" className="hidden w-80 shrink-0 overflow-y-auto border-l border-black/40 bg-[#0b1220] p-4 text-sm text-[#e7ecf4] lg:block">
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
        <p className="mt-4 rounded-xl border border-dashed border-white/20 p-3 text-xs text-[#a6b1c4]">
          Not scored in this build (needs Computer 2 apps): {view.unsupported.join("; ")}.
        </p>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Alarm queue                                                         */
/* ------------------------------------------------------------------ */

function QueueScreen({ view, scn, state, clock, send }: { view: RunView; scn: SimScenario; state: SimState; clock: number; send: (a: SimAction) => boolean }) {
  const [tab, setTab] = useState<"parked" | "patrols">("parked");
  const site = (id: string) => scn.sites.find((s) => s.id === id);
  const queued = scn.alerts.filter((a) => state.alerts[a.id]?.status === "queued").sort((a, b) => a.atMin - b.atMin);
  const parked = scn.alerts.filter((a) => state.alerts[a.id]?.status === "parked");
  const time = (a: { atMin: number }) => immixDate(wall(view.scenario.startLocal, a.atMin * 60));
  return (
    <div className="bg-[#7a1d1d] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl rounded-md bg-[#2b2d30] shadow-xl">
        <div className="flex items-center justify-between border-b border-black/40 px-5 py-3">
          <h1 className="text-lg font-bold tracking-wide">ALARMS</h1>
          <span className="text-xs text-[#b8b8b8]">Simulated monitoring workstation</span>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_180px]">
          <div className="overflow-x-auto rounded border border-black/50">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Alarm queue</caption>
              <thead className="bg-[#3a3c40] text-xs uppercase">
                <tr><th scope="col" className="px-3 py-2">Time</th><th scope="col" className="px-3 py-2">Location</th><th scope="col" className="px-3 py-2">Event</th><th scope="col" className="px-3 py-2">Priority</th><th scope="col" className="px-3 py-2">Alarm count</th></tr>
              </thead>
              <tbody>
                {queued.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-[#b8b8b8]">No alarms in the queue.{view.nextEvent !== null ? " More may arrive — keep monitoring or use Skip ahead." : ""}</td></tr>
                )}
                {queued.map((a) => (
                  <tr key={a.id} className="border-t border-black/30 bg-[#c2601a] text-white">
                    <td className="px-3 py-2 font-mono text-xs">{time(a)}</td>
                    <td className="px-3 py-2">{site(a.siteId)?.name}</td>
                    <td className="px-3 py-2">{a.details}</td>
                    <td className="px-3 py-2">{a.priorityLabel ?? "—"}</td>
                    <td className="px-3 py-2">1</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={!queued.length}
            onClick={() => send({ type: "OPEN_ALERT", alertId: queued[0].id, at: clock })}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-md bg-[#1565c0] font-bold tracking-wide text-white shadow hover:bg-[#1976d2] disabled:opacity-40"
          >
            <ShieldAlert aria-hidden className="size-8" /> PROCESS ALARM
          </button>
        </div>
        <div className="border-t border-black/40 p-4">
          <div role="tablist" aria-label="Queue" className="flex gap-1">
            <button role="tab" type="button" aria-selected={tab === "parked"} onClick={() => setTab("parked")} className={cn("rounded-t px-3 py-1.5 text-sm", tab === "parked" ? "bg-[#3a3c40]" : "text-[#b8b8b8]")}>Parked Events ({parked.length})</button>
            <button role="tab" type="button" aria-selected={tab === "patrols"} onClick={() => setTab("patrols")} className={cn("rounded-t px-3 py-1.5 text-sm", tab === "patrols" ? "bg-[#3a3c40]" : "text-[#b8b8b8]")}>Patrols (0)</button>
          </div>
          <div role="tabpanel" className="rounded-b rounded-tr bg-[#3a3c40] p-3 text-sm">
            {tab === "patrols" ? (
              <p className="text-[#9ec7ff]">No patrols. (Patrols are not part of this scenario.)</p>
            ) : parked.length === 0 ? (
              <p className="text-[#9ec7ff]">No parked events.</p>
            ) : (
              <ul className="grid gap-2">
                {parked.map((a) => {
                  const as = state.alerts[a.id];
                  const left = as.parkedAt != null && as.parkMinutes != null ? as.parkedAt + as.parkMinutes * 60 - clock : 0;
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 rounded bg-[#2b2d30] px-3 py-2">
                      <span className="flex-1">{site(a.siteId)?.name} — {a.details}</span>
                      <span className="font-mono text-xs text-[#b8b8b8]">returns in {mmss(Math.max(0, left))}</span>
                      <button type="button" onClick={() => send({ type: "OPEN_ALERT", alertId: a.id, at: clock })} className="rounded bg-[#4a4c50] px-3 py-1 text-xs hover:bg-[#5a5c60]">Open</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Event screen                                                        */
/* ------------------------------------------------------------------ */

const TABS = ["Alarms", "Current Events", "Previous Events", "Arming/Disarming", "Notes", "Problems", "Audit Event", "Maps", "Scripts"] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY: Partial<Record<Tab, string>> = { Notes: "notes", Maps: "map", Scripts: "scripts", "Previous Events": "previous", "Arming/Disarming": "arming", Alarms: "alarms", "Current Events": "current" };

function EventScreen({ alert, view, scn, state, clock, now, send }: { alert: Alert; view: RunView; scn: SimScenario; state: SimState; clock: number; now: Date; send: (a: SimAction) => boolean }) {
  const site = scn.sites.find((s) => s.id === alert.siteId)!;
  const as = state.alerts[alert.id];
  const [tab, setTab] = useState<Tab>("Alarms");
  const [live, setLive] = useState(alert.cameraId);
  const [modal, setModal] = useState<null | "details" | "park" | "close" | "talkdown">(null);
  const [multi, setMulti] = useState(false);
  const offSiteCams = new Set(scn.alerts.flatMap((a) => (a.clips ? Object.values(a.clips).flatMap((c) => (c?.beats.some((b) => !b.onSite) ? [a.cameraId] : [])) : [])));
  const scene = (cam: string) => sceneFor(cam, site.id, offSiteCams.has(cam));
  const ecareFailed = (cam: string) => scn.alerts.some((a) => a.type === "ECARE_FAILURE" && a.cameraId === cam && a.siteId === site.id && state.alerts[a.id]?.status !== "pending" && !state.alerts[a.id]?.reconnected);
  const speakers = site.cameras.filter((c) => /speaker/i.test(c.name));

  const openTab = (t: Tab) => {
    setTab(t);
    const k = TAB_KEY[t];
    if (k) send({ type: "TAB_VIEWED", alertId: alert.id, tab: k, at: clock });
  };

  const btn = "rounded border border-black/50 bg-[#4a4c50] px-3 py-1.5 text-sm hover:bg-[#5a5c60] disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/40 px-4 py-2">
        <ShieldAlert aria-hidden className="size-5 text-[#4caf50]" />
        <h1 className="mr-auto text-xl font-semibold">{site.name}</h1>
        <button type="button" className={btn} disabled title="Not simulated in this build">Raise</button>
        <button type="button" className={btn} onClick={() => { setModal("details"); send({ type: "DETAILS_VIEWED", alertId: alert.id, at: clock }); }}>Details</button>
        <button type="button" className={btn} onClick={() => { setMulti(true); send({ type: "MULTIVIEW_OPEN", alertId: alert.id, at: clock }); }}>MultiView</button>
        <button type="button" className={btn} onClick={() => setModal("park")}>Park Event</button>
        <button type="button" className={btn} onClick={() => setModal("close")}>Close Event</button>
        <button type="button" className={btn} onClick={() => send({ type: "BACK_TO_QUEUE", alertId: alert.id, at: clock })} title="Return to the alarm queue without closing">Back to queue</button>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.2fr_0.8fr_1.2fr]">
        <ClipPlayer alert={alert} site={site} scene={scene(alert.cameraId)} clock={clock} send={send} startLocal={view.scenario.startLocal} />

        <section aria-label="Cameras" className="flex flex-col rounded border border-black/50 bg-[#3a3c40]">
          <p className="border-b border-black/40 py-2 text-center text-sm">Cameras</p>
          <ul className="max-h-56 overflow-y-auto p-2">
            {site.cameras.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={live === c.id} onClick={() => { setLive(c.id); send({ type: "CAMERA_VIEWED", alertId: alert.id, cameraId: c.id, at: clock }); }} className={cn("w-full rounded px-3 py-1.5 text-left font-mono text-sm hover:bg-white/10", live === c.id && "bg-white/15")}>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setModal("talkdown")} className="mt-auto flex items-center justify-center gap-2 border-t border-black/40 py-2 text-sm hover:bg-white/10">
            <Megaphone aria-hidden className="size-4" /> Audio — talk-down
          </button>
          <p className="border-t border-black/40 py-2 text-center text-sm text-[#c4c4c4]">Edge Devices (not simulated)</p>
        </section>

        <section aria-label={`Live view ${live}`} className="overflow-hidden rounded border-2 border-[#1e6bb8] bg-black">
          <div className="flex items-center justify-between bg-black px-2 py-1 text-sm"><span className="font-semibold">{live}</span><span className="rounded border border-[#4caf50] px-1 text-xs text-[#4caf50]">LIVE</span></div>
          <SimCamera
            scene={scene(live)}
            cameraLabel={live}
            siteCode={site.accountId}
            timeText={clockText(now)}
            subject={subjectOnCamera(scn, state, live, clock)}
            failed={ecareFailed(live)}
            title={`Live view ${live}`}
          />
        </section>
      </div>

      <div className="px-4 pb-4">
        <div role="tablist" aria-label="Event information" className="flex flex-wrap gap-0.5 border-b border-black/40">
          {TABS.map((t) => (
            <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => openTab(t)} className={cn("px-3 py-2 text-sm", tab === t ? "bg-[#4a4c50]" : "text-[#cfcfcf] hover:bg-white/5")}>
              {t === "Notes" ? `Notes (${site.notes.length})` : t}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="min-h-48 rounded-b bg-[#3a3c40] p-4 text-sm">
          <TabContent tab={tab} alert={alert} as={as} site={site} scn={scn} state={state} startLocal={view.scenario.startLocal} />
        </div>
      </div>

      {multi && (
        <Multiview
          site={site}
          scn={scn}
          state={state}
          clock={clock}
          now={now}
          scene={scene}
          ecareFailed={ecareFailed}
          onClose={() => { setMulti(false); send({ type: "MULTIVIEW_CLOSE", alertId: alert.id, at: clock }); }}
        />
      )}
      {modal === "details" && <DetailsModal site={site} onClose={() => setModal(null)} onCall={(c) => send({ type: "CALL_START", alertId: alert.id, contactId: c, at: clock })} />}
      {modal === "park" && <ParkModal onClose={() => setModal(null)} onPark={(minutes, note) => { if (send({ type: "PARK", alertId: alert.id, minutes, note, at: clock })) setModal(null); }} />}
      {modal === "close" && <CloseModal outcomes={view.outcomes} onClose={() => setModal(null)} onSubmit={(outcome, note) => { if (send({ type: "CLOSE", alertId: alert.id, outcome, note, at: clock })) setModal(null); }} />}
      {modal === "talkdown" && (
        <TalkdownModal
          site={site}
          speakers={speakers.length ? speakers : site.cameras}
          defaultTalkdown={view.defaultTalkdown}
          onClose={() => setModal(null)}
          onSpeak={(cameraId, script, usedSiteScript) => { if (send({ type: "PLAY_TALKDOWN", alertId: alert.id, cameraId, script, usedSiteScript, at: clock })) setModal(null); }}
        />
      )}
    </div>
  );
}

function TabContent({ tab, alert, as, site, scn, state, startLocal }: { tab: Tab; alert: Alert; as: SimState["alerts"][string]; site: SimScenario["sites"][number]; scn: SimScenario; state: SimState; startLocal: string }) {
  switch (tab) {
    case "Alarms":
      return (
        <table className="w-full text-left">
          <caption className="sr-only">Alarms for this event</caption>
          <thead><tr className="text-xs uppercase text-[#b8b8b8]"><th scope="col" className="py-1">Time</th><th scope="col">Details</th><th scope="col">Linked camera</th></tr></thead>
          <tbody>
            {as.reconnected && (
              <tr className="border-t border-black/30"><td className="py-1.5 font-mono text-xs">{immixDate(wall(startLocal, (alert.reconnectAtMin ?? 0) * 60))}</td><td>Ecare successfully reconnected to &apos;{alert.cameraId}&apos;</td><td>{alert.cameraId}</td></tr>
            )}
            <tr className="border-t border-black/30"><td className="py-1.5 font-mono text-xs">{immixDate(wall(startLocal, alert.atMin * 60))}</td><td>{alert.details}</td><td>{alert.cameraId}</td></tr>
          </tbody>
        </table>
      );
    case "Current Events": {
      const relevant = state.actions.filter((a) => "alertId" in a && a.alertId === alert.id).slice(-15).reverse();
      const label = (a: SimAction): string => {
        switch (a.type) {
          case "OPEN_ALERT": return "Started processing";
          case "CLIP_SEGMENT": return `Event clip played (${a.phase}, ${a.rate.toFixed(2)}x)`;
          case "TAB_VIEWED": return `${a.tab[0].toUpperCase()}${a.tab.slice(1)} viewed`;
          case "DETAILS_VIEWED": return "Details viewed";
          case "CAMERA_VIEWED": return `Camera viewed ${a.cameraId}`;
          case "MULTIVIEW_OPEN": return "MultiView opened";
          case "MULTIVIEW_CLOSE": return "MultiView closed";
          case "PLAY_TALKDOWN": return `Audio talk-down played on ${a.cameraId}`;
          case "CALL_START": return "Call started";
          case "PARK": return `Event parked for ${a.minutes} min`;
          case "CLOSE": return `Event closed: ${a.outcome}`;
          default: return a.type;
        }
      };
      return relevant.length ? (
        <ul className="grid gap-1">{relevant.map((a, i) => <li key={i} className="flex gap-4"><span className="w-44 shrink-0 font-mono text-xs text-[#b8b8b8]">{immixDate(wall(startLocal, a.at))}</span><span>{label(a)}</span></li>)}</ul>
      ) : <p className="text-[#b8b8b8]">No activity recorded yet.</p>;
    }
    case "Previous Events":
      return site.previousEvents?.length ? <ul className="grid gap-1">{site.previousEvents.map((e) => <li key={e.at} className="flex gap-4"><span className="w-36 shrink-0 font-mono text-xs text-[#b8b8b8]">{e.at}</span><span>{e.summary}</span></li>)}</ul> : <p className="text-[#b8b8b8]">No previous events.</p>;
    case "Arming/Disarming":
      return <p>{site.armingSchedule ?? "No arming schedule on file."}</p>;
    case "Notes":
      return <ul className="grid gap-2">{site.notes.map((n, i) => <li key={i} className="rounded bg-[#2b2d30] px-3 py-2">{n}</li>)}</ul>;
    case "Maps":
      return (
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <p>{site.boundary ?? "No map on file."}</p>
          <svg viewBox="0 0 260 160" className="w-full rounded bg-[#2b2d30]" role="img" aria-label="Site map: property inside the fence, public sidewalk outside">
            <rect x="10" y="10" width="240" height="22" fill="#4a4c50" /><text x="130" y="25" textAnchor="middle" fontSize="10" fill="#e6e6e6">Public sidewalk / street</text>
            <rect x="30" y="45" width="200" height="100" fill="none" stroke="#ffd34d" strokeDasharray="6 4" strokeWidth="2" />
            <text x="130" y="100" textAnchor="middle" fontSize="11" fill="#ffd34d">Property (inside fence)</text>
            {site.cameras.slice(0, 4).map((c, i) => <g key={c.id}><circle cx={50 + i * 55} cy={i % 2 ? 130 : 58} r="5" fill="#4f8fff" /><text x={50 + i * 55} y={i % 2 ? 122 : 72} textAnchor="middle" fontSize="8" fill="#e6e6e6">{c.name.replace("Speaker", "Spk")}</text></g>)}
          </svg>
        </div>
      );
    case "Scripts":
      return site.talkdownScript ? <blockquote className="rounded bg-[#2b2d30] px-4 py-3 italic">“{site.talkdownScript}”</blockquote> : <p>No site-specific script on file.</p>;
    default:
      return <p className="text-[#b8b8b8]">{tab} is not simulated in this build.</p>;
  }
  void scn;
}

/* ------------------------------------------------------------------ */
/* Event clip player — only continuous 1.00x playback counts as review */
/* ------------------------------------------------------------------ */

function ClipPlayer({ alert, site, scene, clock, send, startLocal }: { alert: Alert; site: SimScenario["sites"][number]; scene: ReturnType<typeof sceneFor>; clock: number; send: (a: SimAction) => boolean; startLocal: string }) {
  const phases = (["pre", "post"] as const).filter((p) => alert.clips?.[p]);
  const [phase, setPhase] = useState<"pre" | "post">(phases[0] ?? "pre");
  const clip = alert.clips?.[phase];
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const seg = useRef<{ from: number; rate: number } | null>(null);
  const tRef = useRef(0);
  tRef.current = t;
  const clockRef = useRef(clock);
  clockRef.current = clock;

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
    const step = (now: number) => {
      const next = tRef.current + ((now - last) / 1000) * rate;
      last = now;
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

  if (!clip) {
    return (
      <section aria-label="Event clip" className="grid aspect-video place-items-center rounded border-2 border-[#c62828] bg-[#1f2023] text-2xl font-bold">
        No Footage Available
      </section>
    );
  }
  const beat = clip.beats.find((b) => t >= b.fromSec && t <= b.toSec) ?? clip.beats.at(-1)!;
  const k = beat.toSec > beat.fromSec ? (t - beat.fromSec) / (beat.toSec - beat.fromSec) : 0;
  const subject = beat.subject ? { x: beat.x0 + (beat.x1 - beat.x0) * Math.min(1, Math.max(0, k)), onSite: beat.onSite ?? false, label: beat.label } : null;
  const clipStart = alert.atMin * 60 + (phase === "pre" ? -clip.lengthSec : 0);

  const play = () => {
    if (t >= clip.lengthSec) { setT(0); tRef.current = 0; }
    seg.current = { from: tRef.current, rate };
    setPlaying(true);
  };
  const pause = () => { endSegment(); setPlaying(false); };
  const changeRate = (r: number) => {
    if (playing) { endSegment(); seg.current = { from: tRef.current, rate: r }; }
    setRate(r);
  };
  const seek = (v: number) => {
    if (playing) endSegment();
    setT(v);
    tRef.current = v;
    if (playing) seg.current = { from: v, rate };
  };
  const switchPhase = (p: "pre" | "post") => { pause(); setPhase(p); setT(0); tRef.current = 0; };

  return (
    <section aria-label="Event clip" className="overflow-hidden rounded border-2 border-[#c62828] bg-black">
      <div className="flex items-center gap-1 bg-[#1f2023] p-1">
        {phases.map((p) => (
          <button key={p} type="button" aria-pressed={phase === p} onClick={() => switchPhase(p)} className={cn("rounded px-2 py-0.5 text-xs", phase === p ? "bg-[#4a4c50]" : "text-[#b8b8b8]")}>
            {p === "pre" ? "Pre-alarm" : "Post-alarm"}
          </button>
        ))}
        <span className="ml-auto pr-1 font-mono text-xs text-[#b8b8b8]">{alert.cameraId}</span>
      </div>
      <SimCamera scene={scene} cameraLabel={alert.cameraId} siteCode={site.accountId} timeText={clockText(wall(startLocal, clipStart + t))} subject={subject} title={`Event clip, ${phase === "pre" ? "pre-alarm" : "post-alarm"}`} />
      <p className="sr-only" aria-live="polite">{playing ? "" : beat.label}</p>
      <div className="flex items-center gap-2 bg-[#1f2023] px-2 py-1.5 text-xs">
        <button type="button" onClick={playing ? pause : play} aria-label={playing ? "Pause clip" : "Play clip"} className="grid size-8 place-items-center rounded bg-[#4a4c50] hover:bg-[#5a5c60]">
          {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
        </button>
        <button type="button" onClick={() => changeRate(Math.max(0.5, rate / 2))} aria-label="Slower" className="grid size-7 place-items-center rounded hover:bg-white/10"><Minus aria-hidden className="size-3.5" /></button>
        <span className={cn("w-11 text-center font-mono", rate !== 1 && "text-[#f5b847]")}>{rate.toFixed(2)}x</span>
        <button type="button" onClick={() => changeRate(Math.min(2, rate * 2))} aria-label="Faster" className="grid size-7 place-items-center rounded hover:bg-white/10"><Plus aria-hidden className="size-3.5" /></button>
        <input type="range" min={0} max={clip.lengthSec} step={0.1} value={t} onChange={(e) => seek(Number(e.target.value))} aria-label="Clip position" className="flex-1 accent-[#4f8fff]" />
        <span className="font-mono">{mmss(t)}/{mmss(clip.lengthSec)}</span>
      </div>
      <p className="bg-[#2b2d30] py-1 text-center text-xs text-[#b8b8b8]">Event Details · {alert.details}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* MultiView                                                           */
/* ------------------------------------------------------------------ */

function Multiview({ site, scn, state, clock, now, scene, ecareFailed, onClose }: { site: SimScenario["sites"][number]; scn: SimScenario; state: SimState; clock: number; now: Date; scene: (c: string) => ReturnType<typeof sceneFor>; ecareFailed: (c: string) => boolean; onClose: () => void }) {
  const opened = useRef(clock);
  return (
    <div role="dialog" aria-modal="true" aria-label="MultiView" className="fixed inset-0 z-40 flex flex-col bg-black/95 p-4">
      <div className="mb-3 flex items-center gap-3">
        <Grid2x2 aria-hidden className="size-5" />
        <h2 className="font-semibold">MultiView — {site.name}</h2>
        <span className="font-mono text-sm text-[#b8b8b8]">Open {mmss(clock - opened.current)}</span>
        <button type="button" onClick={onClose} className="ml-auto rounded bg-[#4a4c50] px-3 py-1.5 text-sm hover:bg-[#5a5c60]" autoFocus>Close MultiView</button>
      </div>
      <div className="grid flex-1 content-start gap-3 md:grid-cols-2">
        {site.cameras.map((c) => (
          <div key={c.id} className="overflow-hidden rounded border border-white/20">
            <div className="flex justify-between bg-[#1f2023] px-2 py-1 text-xs"><span>{c.name}</span><span className="text-[#4caf50]">LIVE</span></div>
            <SimCamera scene={scene(c.id)} cameraLabel={c.name} siteCode={site.accountId} timeText={clockText(now)} subject={subjectOnCamera(scn, state, c.id, clock)} failed={ecareFailed(c.id)} title={`MultiView ${c.name}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded border border-black/60 bg-[#2b2d30] shadow-2xl">
        <div className="flex items-center justify-between bg-[#1f2023] px-4 py-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog"><X className="size-4" /></button>
        </div>
        <div className="p-4 text-sm">{children}</div>
      </div>
    </div>
  );
}

const field = "w-full rounded border border-black/60 bg-[#1f2023] px-2 py-1.5 text-sm text-[#e6e6e6]";

function DetailsModal({ site, onClose, onCall }: { site: SimScenario["sites"][number]; onClose: () => void; onCall: (id: string) => void }) {
  const [called, setCalled] = useState<string | null>(null);
  return (
    <Modal title="Site details" onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-[#b8b8b8]">Site</dt><dd>{site.name}</dd>
        <dt className="text-[#b8b8b8]">Account</dt><dd className="font-mono">{site.accountId}</dd>
        <dt className="text-[#b8b8b8]">Address</dt><dd>{site.address}</dd>
        <dt className="text-[#b8b8b8]">Phone</dt><dd className="font-mono">{site.phone}</dd>
        <dt className="text-[#b8b8b8]">Audio</dt><dd>{site.audioAuthorized ? "Authorized" : "Not authorized"}</dd>
      </dl>
      <p className="mt-4 font-semibold">Call list</p>
      <ul className="mt-1 grid gap-1">
        {site.callList.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded bg-[#1f2023] px-3 py-2">
            <span className="flex-1">{c.name} · <span className="text-[#b8b8b8]">{c.role}</span></span>
            <span className="font-mono text-xs">{c.phone}</span>
            <button type="button" onClick={() => { onCall(c.id); setCalled(c.name); }} className="inline-flex items-center gap-1 rounded bg-[#4a4c50] px-2 py-1 text-xs hover:bg-[#5a5c60]"><Phone aria-hidden className="size-3" /> Call</button>
          </li>
        ))}
      </ul>
      {called && <p role="status" className="mt-3 rounded bg-[#0b2a4d] px-3 py-2 text-xs">Call to {called} recorded. Phone conversations are simulated on Computer 2 (Dialpad), which is not built yet.</p>}
    </Modal>
  );
}

function ParkModal({ onClose, onPark }: { onClose: () => void; onPark: (minutes: number, note: string) => void }) {
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [note, setNote] = useState("");
  const minutes = (Number(h) || 0) * 60 + (Number(m) || 0);
  return (
    <Modal title="Park Event" onClose={onClose}>
      <p>Park for</p>
      <div className="mt-2 flex items-center gap-2">
        <input aria-label="Hours" inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} className={cn(field, "w-16")} /> hours,
        <input aria-label="Minutes" inputMode="numeric" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, ""))} className={cn(field, "w-16")} /> minutes.
      </div>
      <label className="mt-3 block">Note:<textarea value={note} maxLength={250} onChange={(e) => setNote(e.target.value)} rows={4} className={cn(field, "mt-1")} /></label>
      <p className="text-xs text-[#b8b8b8]">{note.length} / 250</p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" disabled={minutes <= 0} onClick={() => onPark(minutes, note)} className="rounded bg-[#4a4c50] px-4 py-1.5 hover:bg-[#5a5c60] disabled:opacity-40">Ok</button>
        <button type="button" onClick={onClose} className="rounded bg-[#4a4c50] px-4 py-1.5 hover:bg-[#5a5c60]">Cancel</button>
      </div>
    </Modal>
  );
}

function CloseModal({ outcomes, onClose, onSubmit }: { outcomes: string[]; onClose: () => void; onSubmit: (outcome: string, note: string) => void }) {
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal title="Close Event" onClose={onClose}>
      <label className="block">Outcome:
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={cn(field, "mt-1")}>
          <option value="">Select an outcome…</option>
          {outcomes.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <label className="mt-3 block">Note:<textarea value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} rows={6} className={cn(field, "mt-1")} /></label>
      <p className="text-xs text-[#b8b8b8]">{note.length} / 5000</p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" disabled={!outcome} onClick={() => onSubmit(outcome, note)} className="rounded bg-[#4a4c50] px-4 py-1.5 hover:bg-[#5a5c60] disabled:opacity-40">Ok</button>
        <button type="button" onClick={onClose} className="rounded bg-[#4a4c50] px-4 py-1.5 hover:bg-[#5a5c60]">Cancel</button>
      </div>
    </Modal>
  );
}

function TalkdownModal({ site, speakers, defaultTalkdown, onClose, onSpeak }: { site: SimScenario["sites"][number]; speakers: { id: string; name: string }[]; defaultTalkdown: string | null; onClose: () => void; onSpeak: (cameraId: string, script: string, usedSiteScript: boolean) => void }) {
  const [cam, setCam] = useState(speakers[0]?.id ?? "");
  const [source, setSource] = useState<"site" | "default" | "">(site.talkdownScript ? "site" : defaultTalkdown ? "default" : "");
  const [text, setText] = useState(site.talkdownScript ?? defaultTalkdown ?? "");
  const pick = (s: "site" | "default") => {
    setSource(s);
    setText(s === "site" ? site.talkdownScript ?? "" : defaultTalkdown ?? "");
  };
  const unfilled = /\[[^\]]*\]/.test(text);
  return (
    <Modal title="Audio — talk-down" onClose={onClose}>
      <label className="block">Speaker:
        <select value={cam} onChange={(e) => setCam(e.target.value)} className={cn(field, "mt-1")}>
          {speakers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <fieldset className="mt-3">
        <legend>Script</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" aria-pressed={source === "site"} disabled={!site.talkdownScript} onClick={() => pick("site")} className={cn("rounded px-3 py-1.5 text-xs", source === "site" ? "bg-[#1565c0]" : "bg-[#4a4c50]", "disabled:opacity-40")}>Site script{site.talkdownScript ? "" : " (none on file)"}</button>
          {defaultTalkdown && <button type="button" aria-pressed={source === "default"} onClick={() => pick("default")} className={cn("rounded px-3 py-1.5 text-xs", source === "default" ? "bg-[#1565c0]" : "bg-[#4a4c50]")}>Titan default script</button>}
        </div>
      </fieldset>
      <label className="mt-3 block">What you will say{source === "default" ? " — replace every [bracketed] part" : ""}:
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={1000} className={cn(field, "mt-1")} />
      </label>
      {unfilled && <p className="mt-1 text-xs text-[#f5b847]">Fill in the [bracketed] parts before speaking.</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" disabled={!cam || !text.trim() || unfilled} onClick={() => onSpeak(cam, text, source === "site")} className="inline-flex items-center gap-1.5 rounded bg-[#1565c0] px-4 py-1.5 hover:bg-[#1976d2] disabled:opacity-40"><Megaphone aria-hidden className="size-4" /> Speak</button>
        <button type="button" onClick={onClose} className="rounded bg-[#4a4c50] px-4 py-1.5 hover:bg-[#5a5c60]">Cancel</button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
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

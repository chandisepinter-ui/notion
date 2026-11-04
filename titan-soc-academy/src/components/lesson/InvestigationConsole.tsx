"use client";
/**
 * Simulated IMMIX-style alert workstation (fictional). Reusable across every
 * stage: demonstration (read-only, narrated), guided, practice, challenge and
 * verification. Evidence the learner opens is reported to the server, which
 * refuses decisions made before the required evidence is reviewed.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Circle, FileText, Pause, Play, Phone, ScrollText, CalendarClock, Building2 } from "lucide-react";
import { EVIDENCE_LABELS, type Choice, type EvidenceKey, type ItemResponse, type Scenario, type SiteProfile } from "@/lib/academy/types";
import { CameraScene } from "./CameraScene";
import { cn } from "@/lib/cn";

type InfoTab = Exclude<EvidenceKey, "clip">;
const TABS: { key: InfoTab; icon: typeof FileText }[] = [
  { key: "overview", icon: Building2 },
  { key: "schedule", icon: CalendarClock },
  { key: "plan", icon: ScrollText },
  { key: "contacts", icon: Phone },
];

export type DemoControl = { focus: EvidenceKey | "alert" | "decision"; frameIndex?: number; answer?: ItemResponse };

export function InvestigationConsole({
  scenario,
  site,
  actions,
  requiredEvidence,
  evidence,
  onEvidence,
  response,
  onResponse,
  locked = false,
  demo,
  footer,
  aside,
  idPrefix,
}: {
  scenario: Scenario;
  site: SiteProfile;
  actions: Choice[];
  requiredEvidence: EvidenceKey[];
  evidence: EvidenceKey[];
  onEvidence?: (k: EvidenceKey) => void;
  response: ItemResponse;
  onResponse?: (r: ItemResponse) => void;
  locked?: boolean;
  demo?: DemoControl;
  footer?: ReactNode;
  aside?: ReactNode;
  idPrefix: string;
}) {
  const camera = site.cameras.find((c) => c.id === scenario.cameraId)!;
  const last = scenario.frames.length - 1;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<InfoTab | null>(null);
  const [showText, setShowText] = useState(false);
  const reported = useRef(new Set<EvidenceKey>(evidence));
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Reset when the scenario changes (e.g. next practice item).
  useEffect(() => {
    setFrame(0);
    setPlaying(false);
    setTab(null);
    reported.current = new Set(evidence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  // Demonstration mode drives the console.
  useEffect(() => {
    if (!demo) return;
    if (demo.frameIndex !== undefined) setFrame(demo.frameIndex);
    if (demo.focus === "overview" || demo.focus === "schedule" || demo.focus === "plan" || demo.focus === "contacts") setTab(demo.focus);
  }, [demo]);

  const report = (k: EvidenceKey) => {
    if (demo || !onEvidence || reported.current.has(k)) return;
    reported.current.add(k);
    onEvidence(k);
  };

  // Playback
  useEffect(() => {
    if (!playing) return;
    if (frame >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setFrame((f) => Math.min(f + 1, last)), 1300);
    return () => clearTimeout(t);
  }, [playing, frame, last]);

  useEffect(() => {
    if (frame === last) report("clip");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, last]);

  const openTab = (k: InfoTab) => {
    setTab(k);
    report(k);
  };

  const onTabKey = (e: KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = TABS[(idx + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].key;
    openTab(next);
    tabRefs.current[next]?.focus();
  };

  const seen = new Set(demo ? (["clip", "overview", "schedule", "plan", "contacts"] as EvidenceKey[]) : evidence);
  const missing = requiredEvidence.filter((k) => !seen.has(k));
  const ready = missing.length === 0;
  const f = scenario.frames[frame];
  const shown = demo?.answer ?? response;
  const decisionDisabled = locked || !ready || !!demo || !onResponse;

  const highlight = (k: string) => demo?.focus === k;

  return (
    <div className="grid gap-4">
      {/* Alert header */}
      <div className={cn("titan-panel flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4", highlight("alert") && "ring-2 ring-accent")}>
        <div className="flex items-center gap-3">
          <span className="relative grid size-10 place-items-center rounded-xl bg-danger-soft">
            <span className="animate-live size-2.5 rounded-full bg-danger" aria-hidden />
          </span>
          <div>
            <p className="titan-eyebrow">Alert · {site.siteCode}</p>
            <p className="font-semibold text-fg">{scenario.eventType}</p>
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div><dt className="text-xs text-fg-subtle">Site</dt><dd className="text-fg">{site.name}</dd></div>
          <div><dt className="text-xs text-fg-subtle">Camera</dt><dd className="text-fg">{camera.name}</dd></div>
          <div><dt className="text-xs text-fg-subtle">Day &amp; time</dt><dd className="font-mono text-fg">{scenario.day} {scenario.alertTime}</dd></div>
        </dl>
        <span className="ml-auto rounded-md border border-dashed border-line-strong px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-fg-subtle">Simulation · fictional</span>
      </div>

      {/* Evidence checklist / what to do now */}
      {!demo && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-2/70 px-4 py-3" aria-live="polite">
          <span className="mr-1 text-sm font-medium text-fg">{ready ? "Evidence reviewed. Make your decision below." : "Before deciding, review:"}</span>
          {requiredEvidence.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => (k === "clip" ? document.getElementById(`${idPrefix}-play`)?.focus() : openTab(k as InfoTab))}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
                seen.has(k) ? "border-success/40 bg-success-soft text-success" : "border-line-strong bg-surface text-fg-muted hover:border-accent-line hover:text-fg",
              )}
            >
              {seen.has(k) ? <Check aria-hidden className="size-3.5" /> : <Circle aria-hidden className="size-3" />}
              {k === "clip" ? "Watch clip to the end" : EVIDENCE_LABELS[k]}
              <span className="sr-only">{seen.has(k) ? "(done)" : "(not yet reviewed)"}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        {/* Camera */}
        <section aria-label="Event clip" className={cn("titan-panel overflow-hidden", highlight("clip") && "ring-2 ring-accent")}>
          <div className="relative bg-black">
            <CameraScene
              scene={camera.scene}
              frame={f}
              title={`${camera.name}, frame ${frame + 1} of ${scenario.frames.length}`}
              overlayTop={`${site.siteCode} ${camera.name.split("·")[0].trim()} ${camera.name.split("·")[1]?.trim().toUpperCase() ?? ""}`}
              overlayBottom={`${scenario.day.slice(0, 3).toUpperCase()} ${f.time}`}
            />
            <div className="scene-noise pointer-events-none absolute inset-0" aria-hidden />
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button
              id={`${idPrefix}-play`}
              type="button"
              disabled={!!demo}
              onClick={() => {
                if (frame >= last) setFrame(0);
                setPlaying((p) => !p);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-50"
            >
              {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
              {playing ? "Pause" : frame >= last ? "Replay clip" : "Play clip"}
            </button>
            <button type="button" disabled={!!demo || frame === 0} onClick={() => { setPlaying(false); setFrame((x) => Math.max(0, x - 1)); }} className="grid size-10 place-items-center rounded-xl border border-line text-fg-muted hover:text-fg disabled:opacity-40" aria-label="Previous frame">
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <button type="button" disabled={!!demo || frame === last} onClick={() => { setPlaying(false); setFrame((x) => Math.min(last, x + 1)); }} className="grid size-10 place-items-center rounded-xl border border-line text-fg-muted hover:text-fg disabled:opacity-40" aria-label="Next frame">
              <ChevronRight aria-hidden className="size-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2" aria-hidden>
              {scenario.frames.map((_, i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition-all", i === frame ? "w-6 bg-accent" : i < frame ? "w-3 bg-accent/50" : "w-3 bg-surface-3")} />
              ))}
            </div>
            <span className="font-mono text-xs text-fg-subtle">Frame {frame + 1}/{scenario.frames.length}</span>
            <button type="button" onClick={() => setShowText((v) => !v)} aria-pressed={showText} className="ml-auto h-9 rounded-xl px-3 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg">
              {showText ? "Hide text description" : "Text description"}
            </button>
          </div>
          <p className="sr-only" aria-live="polite">Frame {frame + 1} of {scenario.frames.length}, {f.time}. {f.caption}</p>
          {showText && <p className="border-t border-line px-4 py-3 text-sm text-fg-muted">{f.caption}</p>}
          <p className="border-t border-line px-4 py-2.5 text-xs text-fg-subtle">
            <span className="font-medium text-fg-muted">About this camera:</span> {camera.viewNote}
          </p>
        </section>

        {/* Site instructions */}
        <section aria-label="Site instructions" className={cn("titan-panel flex min-h-[320px] flex-col overflow-hidden", (highlight("overview") || highlight("schedule") || highlight("plan")) && "ring-2 ring-accent")}>
          <div role="tablist" aria-label="Site instructions" className="flex gap-1 overflow-x-auto border-b border-line p-1.5">
            {TABS.map(({ key, icon: Icon }, idx) => (
              <button
                key={key}
                ref={(el) => { tabRefs.current[key] = el; }}
                id={`${idPrefix}-tab-${key}`}
                role="tab"
                type="button"
                aria-selected={tab === key}
                aria-controls={`${idPrefix}-panel`}
                tabIndex={tab === key || (tab === null && idx === 0) ? 0 : -1}
                onKeyDown={(e) => onTabKey(e, idx)}
                onClick={() => openTab(key)}
                disabled={!!demo}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition disabled:cursor-default",
                  tab === key ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {EVIDENCE_LABELS[key]}
                {!demo && requiredEvidence.includes(key) && !seen.has(key) && <span className="size-1.5 rounded-full bg-accent" aria-label="(required)" />}
              </button>
            ))}
          </div>
          <div id={`${idPrefix}-panel`} role="tabpanel" aria-labelledby={tab ? `${idPrefix}-tab-${tab}` : undefined} tabIndex={0} className="flex-1 overflow-y-auto p-5 text-sm">
            {tab === null && (
              <div className="grid h-full place-items-center text-center text-fg-muted">
                <div>
                  <FileText aria-hidden className="mx-auto mb-2 size-6 text-fg-subtle" />
                  <p>Open a tab to read this site’s instructions.</p>
                </div>
              </div>
            )}
            {tab === "overview" && (
              <div className="grid gap-4">
                <div>
                  <p className="text-base font-semibold text-fg">{site.name}</p>
                  <p className="text-fg-subtle">{site.siteCode} · {site.siteType} · {site.address}</p>
                </div>
                <div>
                  <p className="titan-eyebrow mb-1.5">Hours</p>
                  <ul className="grid gap-1 text-fg">{site.hours.map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
                <div>
                  <p className="titan-eyebrow mb-1.5">Cameras</p>
                  <ul className="grid gap-2">
                    {site.cameras.map((c) => (
                      <li key={c.id} className={cn("rounded-xl border px-3 py-2", c.id === camera.id ? "border-accent-line bg-accent-soft" : "border-line")}>
                        <p className="font-medium text-fg">{c.name}{c.id === camera.id && <span className="ml-2 text-xs text-accent-strong">(this alert)</span>}</p>
                        <p className="text-fg-muted">{c.viewNote}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                {site.notes.length > 0 && (
                  <div>
                    <p className="titan-eyebrow mb-1.5">Notes</p>
                    <ul className="list-disc pl-5 text-fg-muted">{site.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            {tab === "schedule" && (
              <div className="grid gap-3">
                <p className="text-fg-muted">Activity is authorized only when it matches an entry: the right day <strong className="text-fg">and</strong> inside the time window.</p>
                {site.schedule.map((s) => (
                  <div key={s.id} className="rounded-xl border border-line p-4">
                    <p className="font-mono text-xs text-fg-subtle">{s.id}</p>
                    <p className="mt-1 font-semibold text-fg">{s.who}</p>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                      <dt className="text-fg-subtle">Days</dt><dd className="text-fg">{s.days}</dd>
                      <dt className="text-fg-subtle">Window</dt><dd className="font-mono text-fg">{s.window}</dd>
                      <dt className="text-fg-subtle">Details</dt><dd className="text-fg-muted">{s.details}</dd>
                    </dl>
                  </div>
                ))}
                <p className="text-xs text-fg-subtle">No other activity is scheduled at this site.</p>
              </div>
            )}
            {tab === "plan" && (
              <ol className="grid gap-3">
                {site.responsePlan.map((r) => (
                  <li key={r.id} className={cn("rounded-xl border p-4", demo?.answer?.rule === r.id && demo.focus !== "clip" && (demo.focus === "plan" || demo.focus === "decision") ? "border-accent-line bg-accent-soft" : "border-line")}>
                    <p className="font-semibold text-fg">{r.title}</p>
                    <p className="mt-1 text-fg-muted"><span className="font-medium text-fg">Applies when:</span> {r.appliesWhen}</p>
                    <ul className="mt-2 list-disc pl-5 text-fg-muted">{r.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                  </li>
                ))}
              </ol>
            )}
            {tab === "contacts" && (
              <ol className="grid gap-2">
                {site.contacts.map((c) => (
                  <li key={c.order} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                    <div><p className="font-medium text-fg">{c.order}. {c.name}</p><p className="text-fg-subtle">{c.role}</p></div>
                    <span className="font-mono text-fg-muted">{c.phone}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      {aside}

      {/* Decision */}
      <section aria-labelledby={`${idPrefix}-decide`} className={cn("titan-panel p-5 sm:p-6", highlight("decision") && "ring-2 ring-accent")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id={`${idPrefix}-decide`} className="text-base font-semibold text-fg">Your decision</h3>
          {!ready && !demo && <p className="text-sm text-fg-subtle">Unlocks after you review: {missing.map((k) => (k === "clip" ? "the full clip" : EVIDENCE_LABELS[k])).join(", ")}.</p>}
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <fieldset disabled={decisionDisabled} className="min-w-0">
            <legend className="mb-2 text-sm font-medium text-fg-muted">1. What will you do?</legend>
            <div className="grid gap-2">
              {actions.map((a) => (
                <ChoiceCard key={a.id} name={`${idPrefix}-action`} checked={shown.action === a.id} onChange={() => onResponse?.({ ...response, action: a.id })} title={a.label} detail={a.detail} disabled={decisionDisabled} />
              ))}
            </div>
          </fieldset>
          <fieldset disabled={decisionDisabled} className="min-w-0">
            <legend className="mb-2 text-sm font-medium text-fg-muted">2. Which response-plan rule supports it?</legend>
            <div className="grid gap-2">
              {site.responsePlan.map((r) => (
                <ChoiceCard key={r.id} name={`${idPrefix}-rule`} checked={shown.rule === r.id} onChange={() => onResponse?.({ ...response, rule: r.id })} title={r.title} disabled={decisionDisabled} />
              ))}
            </div>
          </fieldset>
        </div>
        {footer && <div className="mt-5">{footer}</div>}
      </section>
    </div>
  );
}

function ChoiceCard({ name, checked, onChange, title, detail, disabled }: { name: string; checked: boolean; onChange: () => void; title: string; detail?: string; disabled: boolean }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
        checked ? "border-accent bg-accent-soft" : "border-line bg-surface-2/50 hover:border-line-strong",
        disabled && "cursor-not-allowed opacity-70 hover:border-line",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="peer sr-only" />
      <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", checked ? "border-accent" : "border-line-strong")}>
        {checked && <span className="size-2.5 rounded-full bg-accent" />}
      </span>
      <span>
        <span className="block font-medium text-fg">{title}</span>
        {detail && <span className="mt-0.5 block text-sm text-fg-muted">{detail}</span>}
      </span>
    </label>
  );
}

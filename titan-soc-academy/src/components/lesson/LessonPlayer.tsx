"use client";
/**
 * Lesson player — renders any module built from structured content.
 * All grading happens on the server; this component only displays the
 * sanitized view and sends the learner's actions.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Award, BookOpenCheck, CheckCircle2, ChevronLeft, CircleAlert, Flag, Info, Lightbulb, ListChecks, Loader2, RotateCcw, Save, Target, XCircle } from "lucide-react";
import * as actions from "@/lib/academy/actions";
import type { LessonActionResult } from "@/lib/academy/actions";
import type { LessonView, StepView } from "@/lib/academy/view";
import type { EvidenceKey, ItemResponse } from "@/lib/academy/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InvestigationConsole } from "./InvestigationConsole";
import { FeedbackPanel, StageTracker } from "./Feedback";
import { cn } from "@/lib/cn";

type Run = (fn: () => Promise<LessonActionResult>, opts?: { scrollTop?: boolean }) => void;

export function LessonPlayer({ initial }: { initial: LessonView }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepKey = `${view.step.id}:${view.step.kind === "practice" ? view.step.item.id : ""}:${view.step.kind === "walkthrough" ? view.step.panelIndex : ""}`;
  const prevStepKey = useRef(stepKey);

  // Actions run strictly one after another so saved state is never overwritten.
  const run: Run = useCallback((fn, opts) => {
    setError(null);
    startTransition(async () => {
      const next = queue.current.then(fn);
      queue.current = next.catch(() => {});
      try {
        const r = await next;
        if (r.ok) {
          setView(r.view);
          if (opts?.scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
        } else setError(r.error);
      } catch {
        setError("Connection problem. Your last saved progress is safe — please try again.");
      }
    });
  }, []);

  // Move focus to the new step heading when the step changes (screen readers, keyboard).
  useEffect(() => {
    if (prevStepKey.current !== stepKey) {
      prevStepKey.current = stepKey;
      headingRef.current?.focus();
    }
  }, [stepKey]);

  const key = view.moduleKey;
  const step = view.step;
  const stageIdx = view.stages.findIndex((s) => s.key === step.stage);

  return (
    <div className="grid gap-6">
      {/* Lesson header */}
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/academy" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ChevronLeft aria-hidden className="size-4" /> Academy
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-fg-subtle sm:flex" aria-live="polite">
              {pending ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Save aria-hidden className="size-3.5" />}
              {pending ? "Saving…" : "Progress saved automatically"}
            </span>
            <ButtonLink href="/dashboard" variant="secondary" size="sm">Save &amp; exit</ButtonLink>
          </div>
        </div>
        <div>
          <p className="titan-eyebrow">Day {view.dayNumber} · Stage {stageIdx + 1} of {view.stages.length}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-[1.75rem]">{view.title}</h1>
        </div>
        <StageTracker stages={view.stages} current={step.stage} />
        <p className="flex items-start gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-xs text-fg-subtle">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" /> {view.fictionalNotice}
        </p>
      </div>

      {/* Current task — the learner always knows what to do */}
      <div className="titan-panel flex items-start gap-4 p-5" data-edge="true">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Target aria-hidden className="size-5" /></span>
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-fg outline-none">{step.title}</h2>
          <p className="mt-0.5 text-fg-muted"><span className="font-medium text-fg">Your task:</span> {step.task}</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-fg">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" /> {error}
        </div>
      )}

      <div key={step.id} className="animate-rise">
        <StepRenderer view={view} step={step} run={run} pending={pending} moduleKey={key} />
      </div>
    </div>
  );
}

function StepRenderer({ view, step, run, pending, moduleKey }: { view: LessonView; step: StepView; run: Run; pending: boolean; moduleKey: string }) {
  switch (step.kind) {
    case "briefing":
      return <Briefing step={step} onContinue={() => run(() => actions.continueLesson(moduleKey), { scrollTop: true })} pending={pending} />;
    case "walkthrough":
      return <Walkthrough view={view} step={step} run={run} pending={pending} moduleKey={moduleKey} />;
    case "decision":
    case "practice":
      return <DecisionStep view={view} step={step} run={run} pending={pending} moduleKey={moduleKey} />;
    case "assessment":
      return <Assessment view={view} step={step} run={run} pending={pending} moduleKey={moduleKey} />;
  }
}

/* ------------------------------------------------------------------ */

function Briefing({ step, onContinue, pending }: { step: Extract<StepView, { kind: "briefing" }>; onContinue: () => void; pending: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <article className="titan-panel grid gap-5 p-6 sm:p-8">
        {step.body.map((b, i) => {
          switch (b.type) {
            case "p":
              return <p key={i} className="text-[1.0625rem] leading-relaxed text-fg">{b.text}</p>;
            case "list":
              return <ul key={i} className="list-disc pl-6 text-fg">{b.items.map((t) => <li key={t}>{t}</li>)}</ul>;
            case "callout":
              return (
                <div key={i} className={cn("rounded-2xl border p-4", b.tone === "caution" ? "border-warning/40 bg-warning-soft" : b.tone === "fictional" ? "border-dashed border-line-strong bg-surface-2" : "border-accent-line bg-accent-soft")}>
                  <p className="font-semibold text-fg">{b.title}</p>
                  <p className="mt-1 text-fg-muted">{b.text}</p>
                </div>
              );
            case "sequence":
              return (
                <ol key={i} className="grid gap-3 sm:grid-cols-2">
                  {b.items.map((s) => (
                    <li key={s.title} className="rounded-2xl border border-line bg-surface-2/60 p-4">
                      <p className="font-mono text-sm font-semibold text-accent-strong">{s.title}</p>
                      <p className="mt-1.5 text-fg-muted">{s.text}</p>
                    </li>
                  ))}
                </ol>
              );
          }
        })}
      </article>
      <aside className="titan-panel h-fit p-6">
        <p className="titan-eyebrow mb-3 flex items-center gap-2"><ListChecks aria-hidden className="size-3.5" /> By the end you will</p>
        <ul className="grid gap-3">
          {step.objectives.map((o) => (
            <li key={o} className="flex gap-2.5 text-sm text-fg"><CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />{o}</li>
          ))}
        </ul>
        <Button size="xl" className="mt-6 w-full" onClick={onContinue} disabled={pending}>
          Continue <ArrowRight aria-hidden className="size-5" />
        </Button>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Walkthrough({ view, step, run, pending, moduleKey }: { view: LessonView; step: Extract<StepView, { kind: "walkthrough" }>; run: Run; pending: boolean; moduleKey: string }) {
  const scenario = view.scenarios.find((s) => s.id === step.scenarioId)!;
  const site = view.sites.find((s) => s.id === scenario.siteId)!;
  const panel = step.panels[step.panelIndex];
  const lastPanel = step.panelIndex === step.panels.length - 1;
  const showAnswer = panel.focus === "decision" || panel.focus === "plan";
  return (
    <div className="grid gap-4">
      <div className="titan-panel sticky top-20 z-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-center" aria-live="polite">
        <div className="flex-1">
          <p className="titan-eyebrow">Demonstration · {step.panelIndex + 1} of {step.panels.length}</p>
          <p className="mt-1 font-semibold text-fg">{panel.title}</p>
          <p className="mt-1 text-fg-muted">{panel.text}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="lg" disabled={pending || step.panelIndex === 0} onClick={() => run(() => actions.walkthroughBack(moduleKey))}>
            <ArrowLeft aria-hidden className="size-4" /> Back
          </Button>
          <Button size="lg" disabled={pending} onClick={() => run(() => actions.continueLesson(moduleKey), { scrollTop: lastPanel })}>
            {lastPanel ? "Finish demonstration" : "Next"} <ArrowRight aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
      <InvestigationConsole
        idPrefix={`demo-${step.id}`}
        scenario={scenario}
        site={site}
        actions={view.actions}
        requiredEvidence={["clip", "schedule", "plan"]}
        evidence={[]}
        response={{}}
        demo={{ focus: panel.focus, frameIndex: panel.frameIndex, answer: showAnswer ? step.demonstratedAnswer : {} }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DecisionStep({ view, step, run, pending, moduleKey }: { view: LessonView; step: Extract<StepView, { kind: "decision" | "practice" }>; run: Run; pending: boolean; moduleKey: string }) {
  const { item, itemState } = step;
  const scenario = view.scenarios.find((s) => s.id === item.scenarioId)!;
  const site = view.sites.find((s) => s.id === scenario.siteId)!;
  const [response, setResponse] = useState<ItemResponse>(itemState.lastResponse ?? {});
  const [evidence, setEvidence] = useState<EvidenceKey[]>(itemState.evidence);

  useEffect(() => {
    setResponse(itemState.solved ? itemState.lastResponse ?? {} : itemState.lastResponse ?? {});
    setEvidence(itemState.evidence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  useEffect(() => setEvidence((e) => [...new Set([...e, ...itemState.evidence])]), [itemState.evidence]);

  const complete = !!response.action && !!response.rule;
  const ready = item.requiredEvidence.every((k) => evidence.includes(k));
  const changed = !itemState.lastResponse || itemState.lastResponse.action !== response.action || itemState.lastResponse.rule !== response.rule;
  const isGuide = step.stage === "guide";

  const footer = itemState.solved ? (
    <div className="grid gap-4">
      {itemState.lastFeedback && <FeedbackPanel feedback={itemState.lastFeedback} solved />}
      <Button size="xl" className="w-full sm:w-auto sm:justify-self-end" disabled={pending} onClick={() => run(() => actions.continueLesson(moduleKey), { scrollTop: true })}>
        Continue <ArrowRight aria-hidden className="size-5" />
      </Button>
    </div>
  ) : (
    <div className="grid gap-4">
      {itemState.lastFeedback && <FeedbackPanel feedback={itemState.lastFeedback} solved={false} />}
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {!complete && ready && <p className="text-sm text-fg-subtle sm:mr-auto">Choose one action and one rule.</p>}
        {complete && !changed && itemState.lastFeedback && <p className="text-sm text-fg-subtle sm:mr-auto">Change at least one choice before submitting again.</p>}
        <Button
          size="xl"
          disabled={pending || !ready || !complete || (!!itemState.lastFeedback && !changed)}
          onClick={() => run(() => actions.submitAnswer(moduleKey, step.id, item.id, response))}
        >
          {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Flag aria-hidden className="size-5" />} Submit decision
        </Button>
      </div>
    </div>
  );

  const hints = isGuide ? (
    <div className="titan-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-medium text-fg"><Lightbulb aria-hidden className="size-4 text-accent" /> Hints</p>
        <Button variant="secondary" size="sm" disabled={pending || item.hints.length >= item.hintsAvailable || itemState.solved} onClick={() => run(() => actions.showHint(moduleKey, step.id))}>
          {item.hints.length === 0 ? "Show a hint" : item.hints.length >= item.hintsAvailable ? "No more hints" : "Show another hint"}
        </Button>
      </div>
      {item.hints.length > 0 ? (
        <ol className="mt-3 grid gap-2">
          {item.hints.map((h, i) => <li key={i} className="rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-fg"><span className="font-mono text-xs text-accent-strong">Hint {i + 1}</span> · {h}</li>)}
        </ol>
      ) : (
        <p className="mt-1 text-sm text-fg-subtle">Try it yourself first. Hints are here if you get stuck — using them is fine during guided practice.</p>
      )}
    </div>
  ) : null;

  return (
    <div className="grid gap-4">
      {step.kind === "practice" && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge tone="neutral">Alert {step.position + 1} of up to {step.total}</Badge>
          <Badge tone={step.firstTryCorrect >= step.required ? "success" : "accent"}>
            First-try correct: {step.firstTryCorrect} of {step.required} needed
          </Badge>
          <span className="text-fg-subtle">Get {step.required} right on the first try and you move on early.</span>
        </div>
      )}
      <InvestigationConsole
        key={item.id}
        idPrefix={`${step.id}-${item.id}`}
        scenario={scenario}
        site={site}
        actions={view.actions}
        requiredEvidence={item.requiredEvidence}
        evidence={evidence}
        onEvidence={(k) => {
          setEvidence((e) => (e.includes(k) ? e : [...e, k]));
          run(() => actions.openEvidence(moduleKey, step.id, item.id, k));
        }}
        response={response}
        onResponse={setResponse}
        locked={itemState.solved}
        aside={hints}
        footer={footer}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Assessment({ view, step, run, pending, moduleKey }: { view: LessonView; step: Extract<StepView, { kind: "assessment" }>; run: Run; pending: boolean; moduleKey: string }) {
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState(step.draft);
  const [evidence, setEvidence] = useState(step.evidence);
  useEffect(() => {
    setDraft(step.draft);
    setEvidence(step.evidence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.attempt]);

  if (step.result) return <AssessmentResultView view={view} step={step} run={run} pending={pending} moduleKey={moduleKey} />;

  const item = step.items[idx];
  const scenario = view.scenarios.find((s) => s.id === item.scenarioId)!;
  const site = view.sites.find((s) => s.id === scenario.siteId)!;
  const answered = (id: string) => !!draft[id]?.action && !!draft[id]?.rule;
  const allAnswered = step.items.every((i) => answered(i.id));
  const count = step.items.filter((i) => answered(i.id)).length;

  return (
    <div className="grid gap-4">
      <div className="titan-panel p-5">
        <p className="text-fg-muted">{step.intro}</p>
        <p className="mt-2 text-sm text-fg-subtle">Attempt {step.attempt}. Your answers save as you go. Nothing is graded until you submit.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Verification alerts" className="titan-panel h-fit p-3">
          <p className="titan-eyebrow mb-2 px-2">Alert queue · {count}/{step.items.length} answered</p>
          <ol className="grid gap-1">
            {step.items.map((it, i) => {
              const sc = view.scenarios.find((s) => s.id === it.scenarioId)!;
              const st = view.sites.find((s) => s.id === sc.siteId)!;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-current={i === idx ? "true" : undefined}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", i === idx ? "bg-accent-soft" : "hover:bg-surface-2")}
                  >
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs", answered(it.id) ? "bg-success-soft text-success" : "bg-surface-3 text-fg-muted")}>
                      {answered(it.id) ? <CheckCircle2 aria-label="Answered" className="size-4" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{sc.eventType}</span>
                      <span className="block truncate font-mono text-[0.6875rem] text-fg-subtle">{st.siteCode} · {sc.day.slice(0, 3)} {sc.alertTime.slice(0, 5)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <InvestigationConsole
          key={`${step.attempt}-${item.id}`}
          idPrefix={`verify-${item.id}`}
          scenario={scenario}
          site={site}
          actions={view.actions}
          requiredEvidence={item.requiredEvidence}
          evidence={evidence[item.id] ?? []}
          onEvidence={(k) => {
            setEvidence((e) => ({ ...e, [item.id]: [...new Set([...(e[item.id] ?? []), k])] }));
            run(() => actions.openEvidence(moduleKey, step.id, item.id, k));
          }}
          response={draft[item.id] ?? {}}
          onResponse={(r) => {
            setDraft((d) => ({ ...d, [item.id]: r }));
            run(() => actions.saveAssessmentAnswer(moduleKey, item.id, r));
          }}
          footer={
            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
              <p className="text-sm text-fg-subtle sm:mr-auto">{answered(item.id) ? "Answer saved." : "Choose one action and one rule."}</p>
              {idx < step.items.length - 1 ? (
                <Button size="lg" variant={answered(item.id) ? "primary" : "secondary"} onClick={() => { setIdx(idx + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  Next alert <ArrowRight aria-hidden className="size-4" />
                </Button>
              ) : null}
              <Button size="lg" variant={allAnswered ? "primary" : "secondary"} disabled={!allAnswered || pending} onClick={() => run(() => actions.submitVerification(moduleKey), { scrollTop: true })}>
                <Flag aria-hidden className="size-4" /> {allAnswered ? "Submit verification" : `Answer all ${step.items.length} to submit`}
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}

function AssessmentResultView({ view, step, run, pending, moduleKey }: { view: LessonView; step: Extract<StepView, { kind: "assessment" }>; run: Run; pending: boolean; moduleKey: string }) {
  const r = step.result!;
  return (
    <div className="grid gap-6">
      <section className={cn("titan-panel overflow-hidden p-6 sm:p-8")} data-edge="true" aria-labelledby="result-h">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className={cn("grid size-20 shrink-0 place-items-center rounded-3xl", r.passed ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
            {r.passed ? <Award aria-hidden className="size-10" /> : <RotateCcw aria-hidden className="size-9" />}
          </div>
          <div className="flex-1">
            <p className="titan-eyebrow">Verification · attempt {r.attempt}</p>
            <h3 id="result-h" className="mt-1 text-2xl font-semibold tracking-tight text-fg">
              {r.passed ? "Verified — mastery demonstrated" : "Not yet verified — remediation required"}
            </h3>
            <p className="mt-2 text-fg-muted">
              Score <strong className="text-fg">{r.scorePercent}%</strong> ({r.correctCount} of {r.total}) · Critical errors <strong className="text-fg">{r.criticalErrors}</strong> · Required {step.passPercent}% with no critical errors.
            </p>
            {r.passed && <p className="mt-2 text-sm text-fg-subtle">Your supervisor will validate this competency during the Day 7 review.</p>}
          </div>
          {r.passed && <ButtonLink href="/dashboard" size="xl">Return to dashboard <ArrowRight aria-hidden className="size-5" /></ButtonLink>}
        </div>
      </section>

      {!r.passed && (
        <section className="titan-panel p-6" aria-labelledby="remed-h">
          <h3 id="remed-h" className="flex items-center gap-2 text-lg font-semibold text-fg"><BookOpenCheck aria-hidden className="size-5 text-accent" /> Targeted remediation</h3>
          <p className="mt-1 text-fg-muted">Review the concepts behind your misses. Each is explained two ways. Your retake uses different alerts.</p>
          <div className="mt-4 grid gap-3">
            {step.remediation.map((m) => (
              <div key={m.label} className="rounded-2xl border border-line bg-surface-2/60 p-5">
                <p className="font-semibold text-fg">{m.label}</p>
                {m.explanations.map((e, i) => (
                  <p key={i} className="mt-2 text-sm leading-relaxed text-fg-muted"><span className="font-mono text-xs text-accent-strong">{i === 0 ? "Explanation" : "Another way to see it"}</span> · {e}</p>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            {!step.remediationReviewed ? (
              <Button size="xl" disabled={pending} onClick={() => run(() => actions.completeRemediationReview(moduleKey))}>
                <CheckCircle2 aria-hidden className="size-5" /> I have reviewed these concepts
              </Button>
            ) : (
              <Button size="xl" disabled={pending} onClick={() => run(() => actions.beginRetake(moduleKey), { scrollTop: true })}>
                <RotateCcw aria-hidden className="size-5" /> Start retake (attempt {r.attempt + 1})
              </Button>
            )}
          </div>
        </section>
      )}

      <section className="titan-panel p-6" aria-labelledby="review-h">
        <h3 id="review-h" className="text-lg font-semibold text-fg">Answer review</h3>
        <ol className="mt-4 grid gap-3">
          {r.items.map((it, i) => {
            const sc = view.scenarios.find((s) => s.id === it.scenarioId);
            const site = view.sites.find((s) => s.id === sc?.siteId);
            const chosen = view.actions.find((a) => a.id === it.chosen.action)?.label ?? "—";
            return (
              <li key={it.itemId} className={cn("rounded-2xl border p-5", it.correct ? "border-line" : it.critical ? "border-danger/40" : "border-warning/40")}>
                <div className="flex flex-wrap items-center gap-2">
                  {it.correct ? <CheckCircle2 aria-hidden className="size-5 text-success" /> : <XCircle aria-hidden className="size-5 text-danger" />}
                  <p className="font-semibold text-fg">Alert {i + 1}: {sc?.eventType} · {site?.siteCode} · {sc?.day} {sc?.alertTime.slice(0, 5)}</p>
                  {it.critical && <Badge tone="danger">Critical error</Badge>}
                  <span className="sr-only">{it.correct ? "Correct" : "Incorrect"}</span>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div><dt className="text-fg-subtle">Your answer</dt><dd className="text-fg">{chosen} · {it.chosen.rule}</dd></div>
                  <div><dt className="text-fg-subtle">Correct answer</dt><dd className="text-fg">{it.correctActionLabel} · {it.correctRuleLabel}</dd></div>
                </dl>
                {it.misconception && <p className="titan-eyebrow mt-3">Concept: {it.misconception}</p>}
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{it.explanation}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

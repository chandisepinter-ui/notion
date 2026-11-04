"use client";
/**
 * Player for imported Titan course modules. Grading happens on the server;
 * this component shows the sanitized view and sends the learner's actions.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertOctagon, ArrowLeft, ArrowRight, Award, BookOpenCheck, CheckCircle2, ChevronLeft, CircleAlert, Film, Flag, Info,
  Loader2, MonitorPlay, RotateCcw, Save, ShieldCheck, Target, UserCheck, XCircle,
} from "lucide-react";
import * as actions from "@/lib/course/actions";
import type { CourseActionResult } from "@/lib/course/actions";
import type { CourseStepView, CourseView } from "@/lib/course/view";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StageTracker } from "@/components/lesson/Feedback";
import { ContentStatusBadge } from "./ContentStatus";
import { QuestionCard } from "./QuestionCard";
import { WalkthroughList } from "./WalkthroughPlayer";
import { VideoList } from "./VideoList";
import { startSimRun } from "@/lib/sim/actions";
import { cn } from "@/lib/cn";

type Run = (fn: () => Promise<CourseActionResult>, opts?: { scrollTop?: boolean }) => void;

const TASK: Record<CourseStepView["kind"], string> = {
  prime: "Read the situation. Select Continue when you are ready.",
  cards: "Read this card. Select Next when you understand it.",
  media: "Review the media for this module, then continue.",
  info: "Read the information below, then continue.",
  simulation: "Simulator practice for this module.",
  "pending-source": "Read the notice below and acknowledge it.",
  practice: "Answer the question. You get feedback right away — this does not count toward your score.",
  mastery: "Answer every question, then submit. Results appear after you submit.",
  "supervisor-gate": "Your supervisor completes this part with you.",
};

export function CoursePlayer({ initial }: { initial: CourseView }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const s = view.step;
  const stepKey = `${s.id}:${s.kind === "cards" ? s.index : s.kind === "practice" ? s.position : ""}`;
  const prevKey = useRef(stepKey);

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

  useEffect(() => {
    if (prevKey.current !== stepKey) {
      prevKey.current = stepKey;
      headingRef.current?.focus();
    }
  }, [stepKey]);

  const key = view.moduleKey;
  const next = () => run(() => actions.courseContinue(key), { scrollTop: true });
  const back = () => run(() => actions.courseBack(key), { scrollTop: true });
  const stageIdx = view.stages.findIndex((x) => x.key === s.stage);

  return (
    <div className="grid grid-cols-1 gap-6">
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
          <p className="titan-eyebrow">Day {view.dayNumber} · {view.dayTitle} · {view.moduleKey} · Stage {stageIdx + 1} of {view.stages.length}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-[1.75rem]">{view.title}</h1>
          <p className="mt-1 text-fg-muted"><span className="font-medium text-fg">Goal:</span> {view.competencyTarget}</p>
        </div>
        <StageTracker stages={view.stages} current={s.stage} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
          <ContentStatusBadge status={view.contentStatus} />
          <span>Titan training content. Report anything that does not match current procedure to your supervisor.</span>
        </div>
      </div>

      <div className="titan-panel flex items-start gap-4 p-5" data-edge="true">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Target aria-hidden className="size-5" /></span>
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-fg outline-none">{s.kind === "cards" ? s.card.title : s.title}</h2>
          <p className="mt-0.5 text-fg-muted"><span className="font-medium text-fg">Your task:</span> {s.kind === "media" && s.walkthroughs.length ? "Work through the guided IMMIX walkthroughs below, then continue." : TASK[s.kind]}</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-fg">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" /> {error}
        </div>
      )}

      <div key={stepKey} className="animate-rise">
        <Step view={view} s={s} run={run} pending={pending} next={next} back={back} />
      </div>
    </div>
  );
}

/** An owner ruling that settles a source conflict — shown wherever the conflict affects content. */
export function RulingNote({ r }: { r: { conflictId: string; ruling: string; choice: string; decidedAt: number; decidedBy: string } }) {
  return (
    <div className="mt-5 rounded-2xl border border-success/40 bg-success-soft p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-fg"><ShieldCheck aria-hidden className="size-4 text-success" /> Supervisor ruling · {r.conflictId}</p>
      <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-fg">{r.ruling}</p>
      <p className="mt-1.5 text-xs text-fg-subtle">Decided by {r.decidedBy} · {new Date(r.decidedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. This ruling takes precedence over the card above where they differ.</p>
    </div>
  );
}

/** Renders body text: line breaks become paragraphs; "Why it matters:" etc. get emphasis. */
function Body({ text, large }: { text: string; large?: boolean }) {
  return (
    <div className={cn("grid gap-3 leading-relaxed text-fg", large ? "text-[1.125rem]" : "text-[1.0625rem]")}>
      {text.split("\n").filter(Boolean).map((line, i) => {
        const m = line.match(/^(Why it matters:|Think of it as|Watch for)(.*)$/);
        return m ? (
          <p key={i} className="rounded-xl border-l-2 border-accent bg-accent-soft px-4 py-2.5 text-[0.98em]">
            <strong className="font-semibold">{m[1]}</strong>{m[2]}
          </p>
        ) : (
          <p key={i}>{line}</p>
        );
      })}
    </div>
  );
}

function NavBar({ onBack, onNext, nextLabel = "Continue", canBack, canNext = true, pending }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; canBack?: boolean; canNext?: boolean; pending: boolean }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      {onBack && canBack ? (
        <Button variant="secondary" size="lg" onClick={onBack} disabled={pending}><ArrowLeft aria-hidden className="size-4" /> Back</Button>
      ) : <span />}
      {onNext && (
        <Button size="xl" onClick={onNext} disabled={pending || !canNext}>
          {nextLabel} <ArrowRight aria-hidden className="size-5" />
        </Button>
      )}
    </div>
  );
}

function Step({ view, s, run, pending, next, back }: { view: CourseView; s: CourseStepView; run: Run; pending: boolean; next: () => void; back: () => void }) {
  switch (s.kind) {
    case "prime":
      return (
        <article className="titan-panel p-6 sm:p-8">
          <Body text={s.body} large />
          <NavBar onBack={back} canBack={view.canGoBack} onNext={next} pending={pending} />
        </article>
      );
    case "cards":
      return (
        <article className="titan-panel p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <p className="titan-eyebrow">Learn card {s.index + 1} of {s.total}</p>
            <div className="flex gap-1.5" aria-hidden>
              {Array.from({ length: s.total }).map((_, i) => <span key={i} className={cn("h-1.5 rounded-full", i === s.index ? "w-6 bg-accent" : i < s.index ? "w-3 bg-accent/50" : "w-3 bg-surface-3")} />)}
            </div>
          </div>
          <Body text={s.card.body} />
          {s.card.rulings.map((r) => <RulingNote key={r.conflictId} r={r} />)}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
            {s.card.notVerified && s.card.rulings.length === 0 && <Badge tone="warning">Not verified — confirm with your supervisor</Badge>}
            {s.card.sourceTitle && <span className="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden className="size-3.5" /> Source: {s.card.sourceTitle}</span>}
          </div>
          <NavBar onBack={back} canBack={view.canGoBack} onNext={next} nextLabel={s.index < s.total - 1 ? "Next" : "Continue"} pending={pending} />
        </article>
      );
    case "media":
      return (
        <article className="titan-panel p-6 sm:p-8">
          {s.body && <Body text={s.body.replace(/^NEEDS_RECORDING:\s*/, "")} />}
          <VideoList files={s.files} />
          <WalkthroughList items={s.walkthroughs} pending={pending} onDone={(id, misses) => run(() => actions.courseWalkthroughDone(view.moduleKey, s.id, id, misses))} />
          <NavBar onBack={back} canBack={view.canGoBack} onNext={next} pending={pending} />
        </article>
      );
    case "info":
    case "supervisor-gate":
      return (
        <article className="titan-panel p-6 sm:p-8">
          <div className="grid gap-3">
            {s.cards.map((c, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface-2/60 p-5">
                <p className="font-semibold text-fg">{c.title}</p>
                {c.body && <div className="mt-2"><Body text={c.body} /></div>}
              </div>
            ))}
          </div>
          {s.kind === "supervisor-gate" ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-line-strong p-4 text-sm text-fg-muted">
              <UserCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
              <p>Your supervisor completes and signs this step. The supervisor’s Day 7 rating and sign-off screens arrive in Phase 3, so this step cannot be completed in the app yet.</p>
            </div>
          ) : (
            <NavBar onBack={back} canBack={view.canGoBack} onNext={next} pending={pending} />
          )}
        </article>
      );
    case "simulation":
      return (
        <article className="titan-panel p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><MonitorPlay aria-hidden className="size-5" /></span>
            <div>
              <p className="titan-eyebrow">Simulator · scenario {s.scenarioId}</p>
              <p className="mt-1 text-lg font-semibold text-fg">{s.scenarioTitle}</p>
              {s.brief && <p className="mt-2 text-fg-muted">{s.brief}</p>}
            </div>
          </div>
          {s.playable ? (
            <div className="mt-5 grid gap-3 rounded-2xl border border-line bg-surface-2/60 p-4">
              <p className="text-sm text-fg-muted">Work this alert on the simulated IMMIX workstation. Tasks and hints are shown; your run is scored, but practice does not count toward mastery.</p>
              {s.done && <p className="text-sm"><Badge tone={s.lastPassed ? "success" : "warning"}>Last run {s.lastScore}% · {s.lastPassed ? "passed" : "not passed"}</Badge></p>}
              <form action={startSimRun}>
                <input type="hidden" name="scenarioId" value={s.scenarioId} />
                <input type="hidden" name="mode" value="guided" />
                <input type="hidden" name="moduleKey" value={view.moduleKey} />
                <Button type="submit" size="lg" variant={s.done ? "secondary" : "primary"}><MonitorPlay aria-hidden className="size-4" /> {s.done ? "Practice again" : "Open the simulator"}</Button>
              </form>
              {!s.done && <p className="text-xs text-fg-subtle">Finish one simulator run to continue.</p>}
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line-strong p-4 text-sm text-fg-muted">
              <Badge tone="planned">Needs Computer 2</Badge>
              This scenario also uses Computer 2 apps (HubSpot, TrackTik, phones, radio or Outlook/Teams), which are not simulated yet. Continue to the next step.
            </div>
          )}
          <NavBar onBack={back} canBack={view.canGoBack} onNext={next} canNext={view.canAdvance} pending={pending} />
        </article>
      );
    case "pending-source":
      return (
        <article className="titan-panel p-6 sm:p-8">
          <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-5">
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
            <Body text={s.body} />
          </div>
          {s.acknowledged ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Badge tone="warning">Completed — pending source</Badge>
              <ButtonLink href="/dashboard" size="lg">Return to dashboard <ArrowRight aria-hidden className="size-4" /></ButtonLink>
            </div>
          ) : (
            <NavBar onBack={back} canBack={view.canGoBack} onNext={next} nextLabel="Acknowledge" pending={pending} />
          )}
        </article>
      );
    case "practice":
      return <Practice view={view} s={s} run={run} pending={pending} next={next} back={back} />;
    case "mastery":
      return <Mastery view={view} s={s} run={run} pending={pending} />;
  }
}

function Practice({ view, s, run, pending, next, back }: { view: CourseView; s: Extract<CourseStepView, { kind: "practice" }>; run: Run; pending: boolean; next: () => void; back: () => void }) {
  const [value, setValue] = useState<number[]>(s.last ?? []);
  const fb = s.feedback;
  const changed = JSON.stringify(value) !== JSON.stringify(s.last ?? []);
  const complete = s.question.type === "order" ? value.length === s.question.options.length : value.length > 0;
  const fbRef = useRef<HTMLDivElement>(null);
  useEffect(() => fbRef.current?.focus(), [fb]);
  return (
    <article className="titan-panel p-6 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge>Question {s.position + 1} of {s.total}</Badge>
        <Badge tone="accent">Practice — not scored</Badge>
      </div>
      <QuestionCard q={s.question} value={value} onChange={setValue} disabled={s.solved || pending} />
      {fb && (
        <div ref={fbRef} tabIndex={-1} role="status" className={cn("animate-rise mt-6 rounded-2xl border p-5 outline-none", fb.correct ? "border-success/40 bg-success-soft" : "border-warning/40 bg-warning-soft")}>
          <p className="flex items-center gap-2 font-semibold text-fg">
            {fb.correct ? <CheckCircle2 aria-hidden className="size-5 text-success" /> : <XCircle aria-hidden className="size-5 text-warning" />}
            {fb.correct ? "Correct" : s.solved ? "Not quite — here is the answer" : "Not quite — try again"}
          </p>
          {fb.correctAnswer.length > 0 && !fb.correct && (
            <p className="mt-2 text-sm text-fg"><span className="font-medium">Correct answer:</span> {fb.correctAnswer.join(s.question.type === "order" ? " → " : " · ")}</p>
          )}
          {fb.explanation && <p className="mt-2 leading-relaxed text-fg-muted">{fb.explanation}</p>}
        </div>
      )}
      {s.solved ? (
        <NavBar onBack={back} canBack={view.canGoBack} onNext={next} pending={pending} />
      ) : (
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="secondary" size="lg" onClick={back} disabled={pending || !view.canGoBack}><ArrowLeft aria-hidden className="size-4" /> Back</Button>
          <Button size="xl" disabled={pending || !complete || (!!fb && !changed)} onClick={() => run(() => actions.coursePracticeAnswer(view.moduleKey, s.id, s.question.id, value))}>
            <Flag aria-hidden className="size-5" /> Check answer
          </Button>
        </div>
      )}
    </article>
  );
}

function Mastery({ view, s, run, pending }: { view: CourseView; s: Extract<CourseStepView, { kind: "mastery" }>; run: Run; pending: boolean }) {
  const [draft, setDraft] = useState(s.draft);
  useEffect(() => setDraft(s.draft), [s.attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (s.result) return <MasteryResultView view={view} s={s} run={run} pending={pending} />;
  const done = (id: string, type: string, n: number) => (type === "order" ? (draft[id]?.length ?? 0) === n : (draft[id]?.length ?? 0) > 0);
  const answered = s.questions.filter((q) => done(q.id, q.type, q.options.length)).length;
  const simsDone = s.simRequired.every((c) => c.passed);
  const all = answered === s.questions.length && simsDone;
  const scored = s.questions.filter((q) => q.scored).length;
  return (
    <div className="grid gap-4">
      <div className="titan-panel p-5">
        <p className="text-fg">
          {s.questions.length} questions · {scored} scored. You need <strong>{s.passPercent}%</strong> on scored questions with <strong>no safety-critical errors</strong>. Attempt {s.attempt}.
        </p>
        <p className="mt-1 text-sm text-fg-subtle">Answers save as you go. Nothing is graded until you submit.</p>
        {s.simRequired.length > 0 && (
          <div className="mt-4 grid gap-2">
            <p className="text-sm font-medium text-fg">Simulator check{s.simRequired.length > 1 ? "s" : ""} — required for mastery (mastery mode: no hints)</p>
            {s.simRequired.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
                <span className="flex-1 text-fg">{c.label}</span>
                {c.passed ? <Badge tone="success">Passed</Badge> : c.lastScore !== null ? <Badge tone="warning">Last {c.lastScore}%</Badge> : <Badge>Not attempted</Badge>}
                {!c.passed && (
                  <form action={startSimRun}>
                    <input type="hidden" name="scenarioId" value={c.id} />
                    <input type="hidden" name="mode" value="mastery" />
                    <input type="hidden" name="moduleKey" value={view.moduleKey} />
                    <Button type="submit" size="sm"><MonitorPlay aria-hidden className="size-4" /> Run check</Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
        {s.simulationChecks.length > s.simRequired.length && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <Badge tone="planned">Not included yet</Badge> Simulator checks that need Computer 2 apps are not part of this mastery check yet.
          </p>
        )}
      </div>
      <ol className="grid gap-4">
        {s.questions.map((q, i) => (
          <li key={`${s.attempt}-${q.id}`} className="titan-panel p-6">
            <QuestionCard
              q={q}
              number={i + 1}
              value={draft[q.id] ?? []}
              onChange={(v) => {
                setDraft((d) => ({ ...d, [q.id]: v }));
                run(() => actions.courseSaveMastery(view.moduleKey, q.id, v));
              }}
            />
          </li>
        ))}
      </ol>
      <div className="titan-panel sticky bottom-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg-muted" aria-live="polite">{answered} of {s.questions.length} answered</p>
        <Button size="xl" disabled={!all || pending} onClick={() => run(() => actions.courseSubmitMastery(view.moduleKey), { scrollTop: true })}>
          <Flag aria-hidden className="size-5" /> {all ? "Submit mastery check" : !simsDone && answered === s.questions.length ? "Pass the simulator check to submit" : `Answer all ${s.questions.length} to submit`}
        </Button>
      </div>
    </div>
  );
}

function MasteryResultView({ view, s, run, pending }: { view: CourseView; s: Extract<CourseStepView, { kind: "mastery" }>; run: Run; pending: boolean }) {
  const r = s.result!;
  const missed = r.items.filter((i) => i.graded && !i.correct);
  return (
    <div className="grid gap-6">
      <section className="titan-panel p-6 sm:p-8" data-edge="true" aria-labelledby="res-h">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className={cn("grid size-20 shrink-0 place-items-center rounded-3xl", r.passed ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
            {r.passed ? <Award aria-hidden className="size-10" /> : <RotateCcw aria-hidden className="size-9" />}
          </div>
          <div className="flex-1">
            <p className="titan-eyebrow">Mastery check · attempt {r.attempt}</p>
            <h3 id="res-h" className="mt-1 text-2xl font-semibold tracking-tight text-fg">{r.passed ? "Mastered" : "Not yet — remediation required"}</h3>
            <p className="mt-2 text-fg-muted">
              Score <strong className="text-fg">{r.scorePercent}%</strong> ({r.correctCount} of {r.gradedCount} scored) · Safety-critical errors <strong className="text-fg">{r.criticalErrors}</strong> · Required {s.passPercent}% with none.
            </p>
            {(r.simChecks ?? []).length > 0 && (
              <p className="mt-2 text-sm text-fg-muted">Simulator: {r.simChecks!.map((c) => `${c.id} ${c.passed ? "passed" : "not passed"}`).join(" · ")}</p>
            )}
            {r.passed && <p className="mt-2 text-sm text-fg-subtle">Your supervisor validates practical skills during Day 7.</p>}
          </div>
          {r.passed && <ButtonLink href="/dashboard" size="xl">Next step <ArrowRight aria-hidden className="size-5" /></ButtonLink>}
        </div>
      </section>

      {!r.passed && (
        <section className="titan-panel p-6" aria-labelledby="rem-h">
          <h3 id="rem-h" className="flex items-center gap-2 text-lg font-semibold text-fg"><BookOpenCheck aria-hidden className="size-5 text-accent" /> Targeted remediation</h3>
          <p className="mt-1 text-fg-muted">Read why each missed answer is wrong. Your retest uses the same questions with the answers in a new order.</p>
          <ul className="mt-4 grid gap-3">
            {missed.map((m) => (
              <li key={m.id} className="rounded-2xl border border-line bg-surface-2/60 p-5">
                <p className="font-medium text-fg">{m.prompt}</p>
                {m.critical && <Badge tone="danger" className="mt-2">Safety-critical</Badge>}
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{m.explanation}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end">
            {!s.remediationReviewed ? (
              <Button size="xl" disabled={pending} onClick={() => run(() => actions.courseReviewed(view.moduleKey))}><CheckCircle2 aria-hidden className="size-5" /> I have reviewed these</Button>
            ) : (
              <Button size="xl" disabled={pending} onClick={() => run(() => actions.courseRetest(view.moduleKey), { scrollTop: true })}><RotateCcw aria-hidden className="size-5" /> Start retest (attempt {r.attempt + 1})</Button>
            )}
          </div>
        </section>
      )}

      <section className="titan-panel p-6" aria-labelledby="rev-h">
        <h3 id="rev-h" className="text-lg font-semibold text-fg">Answer review</h3>
        <ol className="mt-4 grid gap-3">
          {r.items.map((it, i) => (
            <li key={it.id} className={cn("rounded-2xl border p-5", it.correct ? "border-line" : it.critical ? "border-danger/40" : "border-warning/40")}>
              <div className="flex flex-wrap items-center gap-2">
                {it.correct ? <CheckCircle2 aria-hidden className="size-5 text-success" /> : it.critical ? <AlertOctagon aria-hidden className="size-5 text-danger" /> : <XCircle aria-hidden className="size-5 text-danger" />}
                <p className="font-medium text-fg">Question {i + 1}</p>
                {!it.graded && <Badge tone="warning">Not scored</Badge>}
                {it.critical && <Badge tone="danger">Safety-critical error</Badge>}
                <span className="sr-only">{it.correct ? "Correct" : "Incorrect"}</span>
              </div>
              <p className="mt-2 text-fg">{it.prompt}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="text-fg-subtle">Your answer</dt><dd className="text-fg">{it.chosen.join(" → ") || "—"}</dd></div>
                <div><dt className="text-fg-subtle">Correct answer</dt><dd className="text-fg">{it.correctAnswer.join(" → ")}</dd></div>
              </dl>
              {it.explanation && <p className="mt-2 text-sm leading-relaxed text-fg-muted"><Info aria-hidden className="mr-1 inline size-3.5" />{it.explanation}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

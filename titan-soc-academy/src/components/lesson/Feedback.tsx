"use client";
import { useEffect, useRef } from "react";
import { AlertOctagon, CheckCircle2, Lightbulb, RotateCcw, XCircle } from "lucide-react";
import type { Feedback } from "@/lib/academy/types";
import { STAGES, type Stage } from "@/lib/academy/types";
import { cn } from "@/lib/cn";

/** Graded feedback. Moves keyboard/screen-reader focus to itself when it appears. */
export function FeedbackPanel({ feedback, solved }: { feedback: Feedback; solved: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [feedback]);
  const tone = feedback.correct ? "success" : feedback.critical ? "danger" : "warning";
  const Icon = feedback.correct ? CheckCircle2 : feedback.critical ? AlertOctagon : XCircle;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className={cn(
        "animate-rise rounded-2xl border p-5 outline-none",
        tone === "success" && "border-success/40 bg-success-soft",
        tone === "warning" && "border-warning/40 bg-warning-soft",
        tone === "danger" && "border-danger/40 bg-danger-soft",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className={cn("mt-0.5 size-6 shrink-0", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-warning")} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-fg">{feedback.headline}</p>
          {!feedback.correct && (
            <p className="mt-1 text-sm text-fg-muted">
              Action: <strong className="text-fg">{feedback.actionCorrect ? "correct" : "not correct"}</strong> · Supporting rule:{" "}
              <strong className="text-fg">{feedback.ruleCorrect ? "correct" : "not correct"}</strong>
            </p>
          )}
          {feedback.misconception && <p className="titan-eyebrow mt-3">Concept: {feedback.misconception}</p>}
          <p className="mt-2 leading-relaxed text-fg">{feedback.message}</p>
          {feedback.alternate && (
            <div className="mt-4 rounded-xl border border-line bg-surface/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Lightbulb aria-hidden className="size-4 text-accent" /> {feedback.alternate.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{feedback.alternate.text}</p>
            </div>
          )}
          {feedback.explanation && (
            <div className="mt-4 rounded-xl border border-line bg-surface/70 p-4">
              <p className="text-sm font-semibold text-fg">Why this is right</p>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{feedback.explanation}</p>
            </div>
          )}
          {!solved && (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-fg">
              <RotateCcw aria-hidden className="size-4" /> Review the evidence again, change your answer, and submit.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function StageTracker({ stages, current }: { stages: { key: Stage; label: string; state: "done" | "current" | "upcoming" }[]; current: Stage }) {
  return (
    <ol className="flex w-full items-center gap-1.5 overflow-x-auto" aria-label="Lesson stages">
      {stages.map((s, i) => (
        <li key={s.key} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={s.key === current ? "step" : undefined}>
          <span
            className={cn(
              "h-1 rounded-full",
              s.state === "done" ? "bg-accent" : s.state === "current" ? "bg-accent/60" : "bg-surface-3",
            )}
            aria-hidden
          />
          <span className={cn("truncate font-mono text-[0.625rem] uppercase tracking-[0.14em]", s.state === "current" ? "text-fg" : "text-fg-subtle")}>
            <span className="hidden sm:inline">{String(i + 1).padStart(2, "0")} </span>
            {s.label}
            <span className="sr-only">{s.state === "done" ? " (complete)" : s.state === "current" ? " (current)" : ""}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export const stageDescription = (k: Stage) => STAGES.find((s) => s.key === k)?.description ?? "";

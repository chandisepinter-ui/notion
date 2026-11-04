"use client";
import { useActionState, useState } from "react";
import { recordDecision, type DecisionState } from "@/lib/admin/decisions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const CHOICES = [
  { value: "A", label: "Source A controls" },
  { value: "B", label: "Source B controls" },
  { value: "CUSTOM", label: "My own ruling" },
  { value: "NOT_APPLICABLE", label: "Not applicable to this platform" },
] as const;

export function DecisionForm({ conflictId, a, b, current }: { conflictId: string; a: string; b: string; current?: { choice: string; ruling: string } }) {
  const [state, action, pending] = useActionState<DecisionState, FormData>(recordDecision, { ok: false });
  const [choice, setChoice] = useState<string>(current?.choice ?? "");
  const [ruling, setRuling] = useState(current?.ruling ?? "");
  const pick = (v: string) => {
    setChoice(v);
    // Pre-fill the ruling from the chosen source so it can be edited into plain operator language.
    if (v === "A" && (!ruling || ruling === b)) setRuling(a);
    if (v === "B" && (!ruling || ruling === a)) setRuling(b);
  };
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="conflictId" value={conflictId} />
      <input type="hidden" name="choice" value={choice} />
      <div role="radiogroup" aria-label={`Ruling for ${conflictId}`} className="flex flex-wrap gap-2">
        {CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={choice === c.value}
            onClick={() => pick(c.value)}
            className={cn("h-10 rounded-xl border px-3 text-sm font-medium transition", choice === c.value ? "border-accent bg-accent-soft text-fg" : "border-line-strong text-fg-muted hover:text-fg")}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Ruling — exactly what operators should do (shown to them in the lessons)
        <textarea
          name="ruling"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          value={ruling}
          onChange={(e) => setRuling(e.target.value)}
          className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm font-normal text-fg"
          placeholder="Example: Call the On-Duty Supervisor line first; if no answer within 15 minutes, call the Senior Supervisor."
        />
      </label>
      <div className="flex items-center justify-end gap-3">
        <p aria-live="polite" className={state.error ? "text-sm text-danger" : "text-sm text-success"}>{state.error ?? (state.ok ? "Ruling saved." : "")}</p>
        <Button type="submit" disabled={pending || !choice}>{pending ? "Saving…" : current ? "Save revised ruling" : "Record ruling"}</Button>
      </div>
    </form>
  );
}

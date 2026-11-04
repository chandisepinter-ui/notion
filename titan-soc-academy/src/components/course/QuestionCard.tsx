"use client";
import { Check, RotateCcw, X } from "lucide-react";
import type { ClientQuestion } from "@/lib/course/view";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

/**
 * One question: single choice (mcq), select-all (multi) or put-in-order (order).
 * `value` holds ORIGINAL option indexes (what the server grades).
 */
export function QuestionCard({
  q,
  value,
  onChange,
  disabled,
  number,
}: {
  q: ClientQuestion;
  value: number[];
  onChange: (v: number[]) => void;
  disabled?: boolean;
  number?: number;
}) {
  const name = `q-${q.id}`;
  const instruction = q.type === "mcq" ? "Choose one answer." : q.type === "multi" ? "Choose every answer that applies." : "Select the steps in the correct order.";
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="w-full">
        <span className="flex flex-wrap items-center gap-2">
          {number !== undefined && <span className="font-mono text-xs text-fg-subtle">Question {number}</span>}
          {!q.scored && <Badge tone="warning">Not scored{q.conflictId && !q.ruling ? ` · pending decision ${q.conflictId}` : ""}</Badge>}
          {q.ruling && <Badge tone="success">Ruling recorded · {q.conflictId}</Badge>}
        </span>
        <span className="mt-1.5 block text-[1.0625rem] font-medium leading-relaxed text-fg">{q.prompt}</span>
        <span className="mt-1 block text-sm text-fg-subtle">{instruction}</span>
        {q.ruling && (
          <span className="mt-3 block rounded-xl border border-success/40 bg-success-soft px-4 py-3 text-sm text-fg">
            <strong>Supervisor ruling ({q.conflictId}):</strong> {q.ruling.ruling}
          </span>
        )}
      </legend>

      {q.type === "order" ? (
        <OrderInput q={q} value={value} onChange={onChange} disabled={disabled} />
      ) : (
        <div className="mt-4 grid gap-2">
          {q.options.map((o) => {
            const checked = value.includes(o.index);
            return (
              <label
                key={o.index}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                  checked ? "border-accent bg-accent-soft" : "border-line bg-surface-2/50 hover:border-line-strong",
                  disabled && "cursor-not-allowed opacity-80 hover:border-line",
                )}
              >
                <input
                  type={q.type === "mcq" ? "radio" : "checkbox"}
                  name={name}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange(q.type === "mcq" ? [o.index] : checked ? value.filter((x) => x !== o.index) : [...value, o.index])}
                  className="sr-only"
                />
                <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center border-2", q.type === "mcq" ? "rounded-full" : "rounded-md", checked ? "border-accent bg-accent text-accent-fg" : "border-line-strong")}>
                  {checked && (q.type === "mcq" ? <span className="size-2 rounded-full bg-accent-fg" /> : <Check className="size-3.5" />)}
                </span>
                <span className="text-fg">{o.text}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function OrderInput({ q, value, onChange, disabled }: { q: ClientQuestion; value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  const remaining = q.options.filter((o) => !value.includes(o.index));
  const text = (i: number) => q.options.find((o) => o.index === i)?.text ?? "";
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium text-fg-muted">Steps — select the next one</p>
        <div className="grid gap-2">
          {remaining.length === 0 && <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-fg-subtle">All steps placed.</p>}
          {remaining.map((o) => (
            <button
              key={o.index}
              type="button"
              disabled={disabled}
              onClick={() => onChange([...value, o.index])}
              className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-left text-fg transition hover:border-accent-line disabled:opacity-60"
            >
              {o.text}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-fg-muted">Your order</p>
          {value.length > 0 && !disabled && (
            <button type="button" onClick={() => onChange([])} className="inline-flex items-center gap-1 text-xs font-medium text-fg-subtle hover:text-fg">
              <RotateCcw aria-hidden className="size-3.5" /> Start over
            </button>
          )}
        </div>
        <ol className="grid gap-2" aria-live="polite">
          {value.map((i, n) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border border-accent-line bg-accent-soft px-4 py-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-mono text-xs text-accent-fg">{n + 1}</span>
              <span className="flex-1 text-fg">{text(i)}</span>
              {!disabled && (
                <button type="button" onClick={() => onChange(value.filter((x) => x !== i))} className="grid size-7 place-items-center rounded-lg text-fg-subtle hover:bg-surface hover:text-fg" aria-label={`Remove ${text(i)}`}>
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
          {value.length === 0 && <li className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-fg-subtle">Nothing placed yet.</li>}
        </ol>
      </div>
    </div>
  );
}

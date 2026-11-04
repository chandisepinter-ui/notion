import { CheckCircle2, XCircle } from "lucide-react";
import type { AttemptRow } from "@/lib/academy/queries";
import { formatDateTime } from "@/lib/academy/queries";
import { Badge } from "@/components/ui/Badge";

/** Table of graded answers — used by Training History and Supervisor review. */
export function AttemptTable({ attempts, caption }: { attempts: AttemptRow[]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wider text-fg-subtle">
            <th scope="col" className="px-6 py-3 font-medium">Result</th>
            <th scope="col" className="px-3 py-3 font-medium">Stage</th>
            <th scope="col" className="px-3 py-3 font-medium">Alert</th>
            <th scope="col" className="px-3 py-3 font-medium">Answer given</th>
            <th scope="col" className="px-3 py-3 font-medium">Concept missed</th>
            <th scope="col" className="px-6 py-3 font-medium">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {attempts.map((a) => (
            <tr key={a.id} className="align-top">
              <td className="px-6 py-3">
                <span className="inline-flex items-center gap-1.5">
                  {a.isCorrect ? <CheckCircle2 aria-hidden className="size-4 text-success" /> : <XCircle aria-hidden className="size-4 text-danger" />}
                  {a.isCorrect ? "Correct" : "Incorrect"}
                </span>
                {a.isCritical && <Badge tone="danger" className="mt-1">Critical</Badge>}
              </td>
              <td className="px-3 py-3 text-fg-muted">
                <span className="font-mono text-xs uppercase">{a.stage}</span>
                <span className="block text-xs text-fg-subtle">{a.assessmentAttempt ? `Attempt ${a.assessmentAttempt}` : `Try ${a.tryNumber}`}</span>
              </td>
              <td className="px-3 py-3 text-fg">{a.scenarioLabel}</td>
              <td className="px-3 py-3 text-fg">{a.actionLabel} · <span className="font-mono">{a.ruleLabel}</span></td>
              <td className="px-3 py-3 text-fg-muted">{a.misconceptionLabel ?? "—"}</td>
              <td className="px-6 py-3 font-mono text-xs text-fg-subtle">{formatDateTime(a.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";
import { useActionState, useEffect, useRef } from "react";
import { addSupervisorNote, type NoteState } from "@/lib/supervisor/actions";
import { Button } from "@/components/ui/Button";

export function NoteForm({ traineeId, modules }: { traineeId: string; modules: { key: string; title: string }[] }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(addSupervisorNote, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  const field = "h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-fg";
  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <input type="hidden" name="traineeId" value={traineeId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-fg">
          Type
          <select name="category" className={field} defaultValue="REMEDIATION">
            <option value="REMEDIATION">Remediation</option>
            <option value="OBSERVATION">Observation</option>
            <option value="COMMENDATION">Commendation</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-fg">
          Related module (optional)
          <select name="moduleKey" className={field} defaultValue="">
            <option value="">None</option>
            {modules.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}
          </select>
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-fg">
        Note
        <textarea name="body" required minLength={5} maxLength={4000} rows={4} className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-fg" placeholder="What did you observe, what was discussed, and what is the expected next step?" />
      </label>
      <div className="flex items-center justify-end gap-3">
        <p aria-live="polite" className={state.error ? "text-sm text-danger" : "text-sm text-success"}>{state.error ?? (state.ok ? "Note saved." : "")}</p>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save note"}</Button>
      </div>
    </form>
  );
}

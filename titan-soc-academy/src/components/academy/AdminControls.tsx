"use client";
import { useState, useTransition } from "react";
import { setAssignment, setUserRole } from "@/lib/admin/actions";
import { cn } from "@/lib/cn";

export function RoleToggles({ userId, roles, held }: { userId: string; roles: { key: string; name: string }[]; held: string[] }) {
  const [current, setCurrent] = useState(held);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Roles">
        {roles.map((r) => {
          const on = current.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={on}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await setUserRole({ userId, roleKey: r.key, enabled: !on });
                  if (res.ok) setCurrent((c) => (on ? c.filter((k) => k !== r.key) : [...c, r.key]));
                  else setError(res.error ?? "Failed.");
                })
              }
              className={cn("h-8 rounded-full border px-3 text-xs font-medium transition disabled:opacity-60", on ? "border-accent bg-accent-soft text-fg" : "border-line-strong text-fg-subtle hover:text-fg")}
            >
              {on ? "✓ " : "+ "}{r.name}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function AssignmentManager({ supervisors, trainees, assignments }: { supervisors: { id: string; name: string }[]; trainees: { id: string; name: string }[]; assignments: { supervisorId: string; traineeId: string }[] }) {
  const [list, setList] = useState(assignments);
  const [sup, setSup] = useState(supervisors[0]?.id ?? "");
  const [tr, setTr] = useState(trainees[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string) => [...supervisors, ...trainees].find((p) => p.id === id)?.name ?? id;
  const change = (supervisorId: string, traineeId: string, assigned: boolean) =>
    start(async () => {
      setError(null);
      const r = await setAssignment({ supervisorId, traineeId, assigned });
      if (!r.ok) return setError(r.error ?? "Failed.");
      setList((l) => (assigned ? [...l.filter((a) => !(a.supervisorId === supervisorId && a.traineeId === traineeId)), { supervisorId, traineeId }] : l.filter((a) => !(a.supervisorId === supervisorId && a.traineeId === traineeId))));
    });
  const field = "h-11 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-fg";
  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-1.5 text-sm font-medium text-fg">Supervisor<select className={field} value={sup} onChange={(e) => setSup(e.target.value)}>{supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="grid flex-1 gap-1.5 text-sm font-medium text-fg">Trainee<select className={field} value={tr} onChange={(e) => setTr(e.target.value)}>{trainees.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <button type="button" disabled={pending || !sup || !tr} onClick={() => change(sup, tr, true)} className="h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-50">Assign</button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {list.length === 0 ? (
        <p className="text-sm text-fg-subtle">No assignments.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {list.map((a) => (
            <li key={`${a.supervisorId}-${a.traineeId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-fg">{name(a.supervisorId)} <span className="text-fg-subtle">supervises</span> {name(a.traineeId)}</span>
              <button type="button" disabled={pending} onClick={() => change(a.supervisorId, a.traineeId, false)} className="text-xs font-medium text-danger hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

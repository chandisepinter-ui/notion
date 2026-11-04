"use client";
/**
 * IMMIX replica screens built from the "Immix Tabs" and "Close Outs" reference
 * screenshots: Close Event (two-level), Raise to routing group, Note Details,
 * Problems, Audit Event (Audit Note / Investigator / Notification),
 * Arming/Disarming, and the Site Details window (Site Details, Call List,
 * Site Staff, Maintainer, Arming Schedule).
 */
import { useState } from "react";
import { CircleX, Trash2 } from "lucide-react";
import type { SimScenario } from "@/lib/sim/types";
import { cn } from "@/lib/cn";
import { Footer, GridTable, IxButton, Modal, ixArea, ixField } from "./ui";

type Site = SimScenario["sites"][number];

/* ------------------------------------------------------------------ */
/* Close Event — level 1 "Outcome :" then level 2 "Select Outcome"     */
/* ------------------------------------------------------------------ */

export function CloseEventModal({ outcomes, subOutcomes, onClose, onSubmit }: { outcomes: string[]; subOutcomes: Record<string, string[]>; onClose: () => void; onSubmit: (outcome: string, sub: string | undefined, note: string) => void }) {
  const [outcome, setOutcome] = useState(outcomes[0] ?? "");
  const [sub, setSub] = useState("");
  const [note, setNote] = useState("");
  const subs = subOutcomes[outcome];
  return (
    <Modal title="Close Event" onClose={onClose}>
      <div className="p-3 text-[12px]">
        <label className="block font-bold text-white"><span className="block">Outcome :</span>
          <select aria-label="Outcome" value={outcome} onChange={(e) => { setOutcome(e.target.value); setSub(""); }} className={cn(ixField, "mt-1 w-full max-w-[298px]")}>
            {outcomes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        {subs?.length ? (
          <select aria-label="Select Outcome" value={sub} onChange={(e) => setSub(e.target.value)} className={cn(ixField, "mt-1.5 w-full max-w-[192px]")}>
            <option value="" disabled>Select Outcome</option>
            {subs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : null}
        <textarea aria-label="Note" value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} rows={7} className={cn(ixArea, "mt-3 bg-[#353535]")} />
        <p className="font-bold text-white">{note.length} / 5000</p>
      </div>
      <Footer>
        <IxButton disabled={!outcome || (!!subs?.length && !sub)} onClick={() => onSubmit(outcome, sub || undefined, note)}>Ok</IxButton>
        <IxButton onClick={onClose}>Cancel</IxButton>
      </Footer>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Raise                                                               */
/* ------------------------------------------------------------------ */

export function RaiseModal({ groups, onClose, onRaise }: { groups: string[]; onClose: () => void; onRaise: (g: string) => void }) {
  const [g, setG] = useState(groups[0] ?? "");
  return (
    <Modal title="Raise to routing group" onClose={onClose} width={306}>
      <div className="p-3 text-[12px] text-white">
        <label className="block">Select a routing group to raise to
          <select aria-label="Routing group" value={g} onChange={(e) => setG(e.target.value)} className={cn(ixField, "mt-1.5 w-full max-w-[198px]")}>
            {groups.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <Footer>
        <IxButton onClick={() => onRaise(g)}>Ok</IxButton>
        <IxButton onClick={onClose}>Cancel</IxButton>
      </Footer>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Notes → Add new note → "Note Details"                               */
/* ------------------------------------------------------------------ */

export function NoteDetailsModal({ onClose, onSave }: { onClose: () => void; onSave: (note: string, from: string, to: string) => void }) {
  const [note, setNote] = useState("");
  const [sd, setSd] = useState("");
  const [st, setSt] = useState("");
  const [ed, setEd] = useState("");
  const [et, setEt] = useState("");
  const [ack, setAck] = useState(false);
  const [mode, setMode] = useState({ always: false, event: false, user: false });
  const box = "border border-[#888] bg-[#282828] px-1 py-0.5 text-[12px] text-white";
  const row = (label: string, d: string, setD: (v: string) => void, t: string, setT: (v: string) => void) => (
    <div className="mt-3">
      <p>{label}</p>
      <div className="mt-1 flex items-center gap-3">
        <input aria-label={`${label} date`} placeholder="MM/DD/YYYY" value={d} onChange={(e) => setD(e.target.value)} className={cn(box, "w-[260px]")} />
        <span>Time:</span>
        <input aria-label={`${label} time`} placeholder=" : " value={t} onChange={(e) => setT(e.target.value)} className={cn(box, "w-[54px]")} />
        <button type="button" aria-label={`Clear ${label.replace(":", "")}`} onClick={() => { setD(""); setT(""); }} className="text-white"><Trash2 aria-hidden className="size-4" /></button>
      </div>
    </div>
  );
  return (
    <Modal title="Note Details" onClose={onClose} width={1005}>
      <div className="p-4 text-[12px] text-white">
        <label className="block">Note
          <textarea aria-label="Note text" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full max-w-[915px] border-2 border-white bg-[#282828] p-2 text-[13px] text-white" />
        </label>
        {row("Start:", sd, setSd, st, setSt)}
        {row("End:", ed, setEd, et, setEt)}
        <label className="mt-4 flex items-center gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Requires Acknowledgement</label>
        <div className="ml-5 mt-1 grid gap-1">
          <label className="flex items-center gap-2"><input type="checkbox" checked={mode.always} onChange={(e) => setMode({ ...mode, always: e.target.checked })} /> Always - Require users to always acknowledge the note.</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={mode.event} onChange={(e) => setMode({ ...mode, event: e.target.checked })} /> Per Event - Require users to acknowledge the note each time they process a new event.</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={mode.user} onChange={(e) => setMode({ ...mode, user: e.target.checked })} /> Per User - Require users to only need to acknowledge the note once in its lifetime.</label>
        </div>
        <label className="mt-4 flex items-center gap-2">Display Type:
          <select aria-label="Display Type" className={cn(ixField, "w-[192px]")} defaultValue="Normal"><option>Normal</option></select>
        </label>
      </div>
      <Footer>
        <IxButton disabled={!note.trim()} onClick={() => onSave(note, [sd, st].filter(Boolean).join(" "), [ed, et].filter(Boolean).join(" "))}>Ok</IxButton>
        <IxButton onClick={onClose}>Cancel</IxButton>
      </Footer>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Problems tab                                                        */
/* ------------------------------------------------------------------ */

export function ProblemsTab({ problems, onAdd }: { problems: { at: string; title: string; text: string; by: string }[]; onAdd: (title: string, text: string) => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const star = <span className="text-[#c0392b]">*</span>;
  return (
    <div className="grid gap-4">
      <GridTable caption="Problems" headBg="#1f1f1f" head={["Created", "Title", "Created By", "Status", "Comments"]} rows={problems.map((p) => [p.at, p.title, p.by, "Open", p.text])} />
      <div className="border border-[#555] bg-[#353535] px-8 py-6 text-[13px]">
        <h3 className="text-[18px] uppercase text-[#d0d0d0]">Add a new problem</h3>
        <label className="mt-4 block">Title {star}<input aria-label="Problem title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full max-w-[1683px] border border-[#888] bg-[#282828] px-2 py-1 text-white" /></label>
        <label className="mt-3 block">Problem text {star}<textarea aria-label="Problem text" value={text} onChange={(e) => setText(e.target.value)} rows={2} className="mt-1 block w-full max-w-[1683px] border border-[#888] bg-[#282828] px-2 py-1 text-white" /></label>
        <div className="mt-4 flex gap-1.5">
          <IxButton disabled={!title.trim() || !text.trim()} onClick={() => { onAdd(title.trim(), text.trim()); setTitle(""); setText(""); }}>Add</IxButton>
          <IxButton onClick={() => { setTitle(""); setText(""); }}>Clear</IxButton>
        </div>
        <p className="mt-2 text-[11px] text-[#bdbdbd]">fields marked with {star} are required</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audit Event tab                                                     */
/* ------------------------------------------------------------------ */

const AUDIT_MENU = ["Audit Note", "Investigator Dispatched", "Investigator Arrived", "Investigator Leaving", "Notification"] as const;
export type AuditKind = (typeof AUDIT_MENU)[number];

export function AuditEventTab({ site, policePhone, firePhone, onAuditNote, onNotification }: {
  site: Site;
  policePhone: string | null;
  firePhone: string | null;
  onAuditNote: (kind: AuditKind, note: string) => void;
  onNotification: (n: { contactType: "Subscriber" | "Police" | "Fire Dept"; contactId?: string; result: "No Answer" | "Call Made"; details: string }) => void;
}) {
  const [kind, setKind] = useState<AuditKind>("Audit Note");
  const [note, setNote] = useState("");
  const [ctype, setCtype] = useState<"Subscriber" | "Police" | "Fire Dept">("Subscriber");
  const [contact, setContact] = useState(site.callList[0]?.id ?? "");
  const [result, setResult] = useState<"No Answer" | "Call Made">("No Answer");
  const [details, setDetails] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <div className="flex gap-4">
      <div role="tablist" aria-label="Audit type" aria-orientation="vertical" className="grid w-[370px] shrink-0 content-start">
        {AUDIT_MENU.map((m) => (
          <button key={m} role="tab" type="button" aria-selected={kind === m} onClick={() => { setKind(m); setSaved(null); }} className={cn("h-12 border border-[#777] px-4 text-left text-[17px]", kind === m ? "bg-[#555555] text-[#eeeeee]" : "bg-[#353535] text-[#bbbbbb]")}>
            {m}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-w-0 flex-1 text-[12px]">
        {kind !== "Notification" ? (
          <div>
            <input aria-label={kind} value={note} onChange={(e) => setNote(e.target.value)} className="h-[37px] w-full border border-[#888] bg-[#282828] px-2 text-[13px] text-white" />
            <IxButton className="mt-3" disabled={!note.trim()} onClick={() => { onAuditNote(kind, note.trim()); setNote(""); setSaved(`${kind} recorded.`); }}>Add Audit Note</IxButton>
          </div>
        ) : (
          <div className="text-white">
            <div className="flex flex-wrap items-center gap-10">
              <select aria-label="Contact type" value={ctype} onChange={(e) => setCtype(e.target.value as typeof ctype)} className={cn(ixField, "w-[192px]")}>
                <option>Subscriber</option><option>Police</option><option>Fire Dept</option>
              </select>
              {ctype === "Subscriber" ? (
                <select aria-label="Contact" value={contact} onChange={(e) => setContact(e.target.value)} className={cn(ixField, "w-[203px]")}>
                  {site.callList.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              ) : (
                <p className="font-bold">{ctype} : {ctype === "Police" ? policePhone ?? "" : firePhone ?? ""}</p>
              )}
            </div>
            <fieldset className="mt-4 grid gap-1">
              <legend className="sr-only">Call result</legend>
              {(["No Answer", "Call Made"] as const).map((r) => (
                <label key={r} className="flex items-center gap-2"><input type="radio" name="call-result" checked={result === r} onChange={() => setResult(r)} /> {r}</label>
              ))}
            </fieldset>
            <label className="mt-4 block font-bold">Additional Details :
              <textarea aria-label="Additional Details" value={details} onChange={(e) => setDetails(e.target.value)} rows={4} className="mt-1 block w-[278px] border border-[#888] bg-[#282828] p-1 font-normal text-white" />
            </label>
            <IxButton className="mt-3" onClick={() => { onNotification({ contactType: ctype, contactId: ctype === "Subscriber" ? contact : undefined, result, details }); setDetails(""); setSaved("Notification recorded."); }}>Audit</IxButton>
          </div>
        )}
        {saved && <p role="status" className="mt-2 text-[12px] text-[#9ed2ff]">{saved}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Arming/Disarming tab                                                */
/* ------------------------------------------------------------------ */

export function ArmingDisarmingTab({ site, tzLabel, onDisarm }: { site: Site; tzLabel: string; onDisarm: () => void }) {
  const [q, setQ] = useState("");
  const rows = site.cameras.filter((c) => !/speaker/i.test(c.name)).map((c) => `${c.name} Object Detected`).filter((t) => t.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="text-[12px]">
      <p className="text-right text-[11px] text-white">Times set here are local to the sites timezone: {tzLabel}</p>
      <div className="flex items-center gap-1.5">
        <IxButton onClick={onDisarm}>Disarm Site</IxButton>
        <input aria-label="Search Alarms" placeholder="Search Alarms" value={q} onChange={(e) => setQ(e.target.value)} className="h-[27px] w-[293px] border border-[#888] bg-[#282828] px-2 text-white placeholder:text-[#8e8e8e]" />
      </div>
      <button type="button" onClick={() => setQ("")} className="mt-2 inline-flex items-center gap-1 font-bold text-[#3d9bff]"><CircleX aria-hidden className="size-4 text-[#9e9e9e]" />Clear Search</button>
      <div className="mt-1 flex justify-end"><span className="border border-[#777] bg-[#1f1f1f] px-3 py-1.5 text-white">Alarm Groups</span></div>
      <GridTable caption="Alarm inputs" headBg="#232424" rowBg="#1b481e" widths={["66px", "66px", undefined, "31%", "31%"]} head={["Input 1", "Input 2", "Alarm Title", "Event Type", "Disarm Info"]} rows={rows.map((t) => [<span key="1" className="block text-right">-1</span>, <span key="2" className="block text-right">-1</span>, t, "", ""])} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Site Details window                                                 */
/* ------------------------------------------------------------------ */

const DET_TABS = ["Site Details", "Call List", "Site Staff", "Maintainer", "Arming Schedule"] as const;

/** Armed hours per weekday parsed from text like "Armed daily 21:00–06:00" (null if not parseable). */
export function parseArming(text: string | undefined): { day: string; armed: [number, number][] }[] | null {
  const m = text?.match(/(\d{1,2}):?(\d{2})\s*[–-]\s*(\d{1,2}):?(\d{2})/);
  if (!m || !/daily/i.test(text ?? "")) return null;
  const a = +m[1] + +m[2] / 60, b = +m[3] + +m[4] / 60;
  const armed: [number, number][] = a > b ? [[0, b], [a, 24]] : [[a, b]];
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Holidays"].map((day) => ({ day, armed }));
}

export function SiteDetailsContent({ site, policePhone, firePhone }: { site: Site; policePhone: string | null; firePhone: string | null }) {
  const [tab, setTab] = useState<(typeof DET_TABS)[number]>("Site Details");
  const [street, ...rest] = site.address.split(",");
  const schedule = parseArming(site.armingSchedule);
  return (
    <div className="bg-[#1f1f1f] text-[12px] text-white">
      <div role="tablist" aria-label="Site details" className="flex">
        {DET_TABS.map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("border-r border-black px-3 py-1.5 text-[13px]", tab === t && "bg-[#505050]")}>{t}</button>
        ))}
      </div>
      <div role="tabpanel" className="min-h-[120px] bg-[#353535] px-5 py-4">
        {tab === "Site Details" && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[14px] font-bold">Site Details</p>
              <p className="mt-2 font-bold">Address:</p>
              <p>{street}</p>
              <p>{rest.join(",").trim()}</p>
              <p className="mt-3 font-bold">Site Notes:</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1 pt-6">
              <dt className="font-bold">Telephone:</dt><dd>{site.phone}</dd>
              <dt className="font-bold">Alt Telephone:</dt><dd></dd>
              <dt className="font-bold">Fax:</dt><dd></dd>
              <dt className="font-bold">Police Telephone:</dt><dd>{policePhone ?? ""}</dd>
              <dt className="font-bold">Fire Telephone:</dt><dd>{firePhone ?? ""}</dd>
            </dl>
          </div>
        )}
        {tab === "Call List" && (
          <table className="w-full border border-[#777] text-left">
            <caption className="sr-only">Call list</caption>
            <thead className="bg-[#555555] text-[12px] font-bold uppercase"><tr><th scope="col" className="px-4 py-1.5">Name</th><th scope="col">Phone Number</th><th scope="col">Mobile Number</th></tr></thead>
            <tbody>
              {site.callList.map((c, i) => (
                <tr key={c.id} className={i % 2 ? "bg-[#303030]" : "bg-[#353535]"}><td className="px-4 py-1.5 font-bold">{c.name}</td><td>Tel : {c.phone}</td><td>Mobile :</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {(tab === "Site Staff" || tab === "Maintainer") && <p className="text-[#cfcfcf]">No {tab === "Site Staff" ? "site staff" : "maintainer"} on file.</p>}
        {tab === "Arming Schedule" && (schedule ? (
          <div className="grid grid-cols-[90px_1fr] gap-y-1.5">
            <span />
            <div className="relative h-6 bg-white text-[10px] text-black" aria-hidden>
              {[0, 4, 8, 12, 16, 20, 24].map((h) => <span key={h} className="absolute top-0.5 -translate-x-1/2" style={{ left: `${(h / 24) * 100}%` }}>{h}</span>)}
            </div>
            {schedule.map((d) => (
              <div key={d.day} className="contents">
                <span>{d.day}</span>
                <div className="relative h-3 border border-[#e05050] bg-[#f8a3a3]" aria-label={`${d.day}: armed ${d.armed.map(([a, b]) => `${a}:00–${b}:00`).join(" and ")}`} role="img">
                  {d.armed.map(([a, b], i) => <span key={i} className="absolute inset-y-0 bg-[#66ff66]" style={{ left: `${(a / 24) * 100}%`, width: `${((b - a) / 24) * 100}%` }} />)}
                </div>
              </div>
            ))}
          </div>
        ) : <p>{site.armingSchedule ?? "No arming schedule on file."}</p>)}
      </div>
    </div>
  );
}

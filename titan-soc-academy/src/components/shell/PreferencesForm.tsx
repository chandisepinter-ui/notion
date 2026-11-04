"use client";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { savePreferences } from "@/lib/prefs/actions";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/cn";

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("h-9 rounded-[10px] px-3 text-sm font-medium transition", value === o.value ? "bg-surface text-fg shadow-sm" : "text-fg-subtle hover:text-fg")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PreferencesForm({ theme, textSize, motion }: { theme: string; textSize: string; motion: string }) {
  const [text, setText] = useState(textSize);
  const [mo, setMo] = useState(motion);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();
  const save = (p: Parameters<typeof savePreferences>[0]) =>
    start(async () => {
      await savePreferences(p);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });
  return (
    <div className="grid gap-6">
      <Row title="Color theme" help="Light, dark, or match your device.">
        <ThemeToggle initial={theme} />
      </Row>
      <Row title="Text size" help="Large text increases the size of everything on screen.">
        <Segmented label="Text size" value={text} options={[{ value: "standard", label: "Standard" }, { value: "large", label: "Large" }]}
          onChange={(v) => { setText(v); document.documentElement.setAttribute("data-text", v); save({ textSize: v }); }} />
      </Row>
      <Row title="Motion" help="Reduce animation if movement is distracting or uncomfortable.">
        <Segmented label="Motion" value={mo} options={[{ value: "system", label: "Match device" }, { value: "reduced", label: "Reduced" }, { value: "full", label: "Full" }]}
          onChange={(v) => { setMo(v); document.documentElement.setAttribute("data-motion", v); save({ motion: v }); }} />
      </Row>
      <p className="h-5 text-sm text-success" aria-live="polite">{saved && <span className="inline-flex items-center gap-1.5"><Check aria-hidden className="size-4" /> Saved to your profile</span>}</p>
    </div>
  );
}

function Row({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-medium text-fg">{title}</p><p className="text-sm text-fg-muted">{help}</p></div>
      {children}
    </div>
  );
}

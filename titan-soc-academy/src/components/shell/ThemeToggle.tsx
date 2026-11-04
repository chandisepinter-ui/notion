"use client";
import { useState, useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { savePreferences } from "@/lib/prefs/actions";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Match device", Icon: Monitor },
] as const;

export function applyTheme(pref: string) {
  const d = document.documentElement;
  d.setAttribute("data-theme-pref", pref);
  const resolved = pref === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
  d.setAttribute("data-theme", resolved);
}

/** Three-way segmented control. Applies instantly, then saves to profile. */
export function ThemeToggle({ initial, compact }: { initial: string; compact?: boolean }) {
  const [value, setValue] = useState(initial);
  const [, start] = useTransition();
  return (
    <div role="radiogroup" aria-label="Color theme" className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5">
      {OPTIONS.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          title={label}
          onClick={() => {
            setValue(v);
            applyTheme(v);
            start(() => void savePreferences({ theme: v }));
          }}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-medium transition",
            value === v ? "bg-surface text-fg shadow-sm" : "text-fg-subtle hover:text-fg",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          <span className={compact ? "sr-only" : ""}>{label}</span>
        </button>
      ))}
    </div>
  );
}

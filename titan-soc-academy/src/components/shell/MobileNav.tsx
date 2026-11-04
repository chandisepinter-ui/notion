"use client";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLinks } from "./NavLinks";
import type { NavSection } from "./nav";
import { TitanWordmark } from "@/components/ui/TitanMark";

/** Slide-in navigation for small screens. Closes on Escape, backdrop click, or navigation. */
export function MobileNav({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>("a,button");
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2 text-fg lg:hidden"
      >
        <Menu aria-hidden className="size-5" />
        <span className="sr-only">Open menu</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <div
            id="mobile-nav"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="animate-rise absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col gap-6 overflow-y-auto border-r border-line bg-bg-elevated p-5"
          >
            <div className="flex items-center justify-between">
              <TitanWordmark />
              <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl text-fg-muted hover:bg-surface-2">
                <X aria-hidden className="size-5" />
                <span className="sr-only">Close menu</span>
              </button>
            </div>
            <NavLinks sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

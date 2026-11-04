"use client";
/** Shared IMMIX replica controls (palette and styles measured from the reference screenshots). */
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/* IMMIX palette (measured from the reference screenshots) */
export const C = {
  page: "#343434", body: "#3c3c3c", tabbar: "#1f1f1f", tabSel: "#505050", dark: "#282828", hdr: "#232424",
  btnFrom: "#8f9191", btnTo: "#6a6c6c", red: "#b84141", blue: "#006699", alarmRed: "#cc1919", orange: "#cc630d", process: "#0151a3",
};
export const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";


export function IxButton({ children, className, ...p }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...p}
      className={cn("h-[27px] rounded-[2px] border border-[#9e9e9e] px-3 text-[13px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 disabled:cursor-default disabled:text-[#bdbdbd] disabled:brightness-90", className)}
      style={{ background: `linear-gradient(${C.btnFrom}, ${C.btnTo})` }}
    >
      {children}
    </button>
  );
}

export function NotSimulated({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div role="status" className="fixed left-1/2 top-16 z-[60] -translate-x-1/2 rounded bg-black/85 px-4 py-2 text-xs text-white">{text}</div>;
}

export function GridTable({ head, rows, caption, headBg = "#4c4c4c", rowBg, widths }: { head: string[]; rows: React.ReactNode[][]; caption: string; headBg?: string; rowBg?: string; widths?: (string | undefined)[] }) {
  return (
    <table className="w-full border border-[#555] text-left text-[13px]">
      <caption className="sr-only">{caption}</caption>
      {widths && <colgroup>{head.map((_, i) => <col key={i} style={{ width: widths[i] }} />)}</colgroup>}
      <thead className="text-[14px] font-bold text-white" style={{ background: headBg }}>
        <tr>{head.map((h, i) => <th key={i} scope="col" className="border-r border-[#555] px-1.5 py-1">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={cn("border-t border-[#555]", !rowBg && (i % 2 ? "bg-[#454545]" : "bg-[#3c3c3c]"))} style={rowBg ? { background: rowBg } : undefined}>
            {r.map((c, j) => <td key={j} className="px-1.5 py-1.5 align-top">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Modal({ title, onClose, children, width = 506 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full border border-[#555] shadow-2xl" style={{ maxWidth: width, background: "#303030" }}>
        <div className="flex items-center justify-between bg-[#1f1f1f] px-3 py-2">
          <h2 className="text-[13px] font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-white"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
export const ixField = "rounded-[6px] border-2 border-[#d0d0d0] bg-[#343434] px-2 py-0.5 text-[12px] text-white";
export const ixArea = "w-full border border-[#777] bg-[#343434] p-2 text-[13px] text-white";
export function Footer({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-1.5 border-t border-[#555] px-3 py-3">{children}</div>;
}


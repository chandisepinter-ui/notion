"use client";
/**
 * Guided IMMIX walkthrough player — the click-through screen sequences from the
 * Titan Power Apps Academy build. The learner clicks where they would click in
 * IMMIX; a wrong click shows the hint, two wrong clicks on a screen reveal the
 * target. Ungraded GUIDE practice: completion and wrong-click count are saved.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MousePointerClick, RotateCcw, X } from "lucide-react";
import type { ClientWalkthrough } from "@/lib/course/view";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type Feedback = { tone: "ok" | "miss"; text: string } | null;

export function WalkthroughList({ items, onDone, pending }: { items: ClientWalkthrough[]; onDone: (id: string, misses: number) => void; pending: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!items.length) return null;
  const active = items.find((w) => w.id === open);
  const done = items.filter((w) => w.done).length;
  return (
    <section aria-labelledby="wt-heading" className="mt-6 grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="wt-heading" className="font-semibold text-fg">Guided IMMIX walkthroughs</h3>
        <span className="text-sm text-fg-muted">{done} of {items.length} finished</span>
      </div>
      <p className="text-sm text-fg-muted">Click where you would click in IMMIX. Wrong clicks show a hint; this practice is not scored.</p>
      {active ? (
        <Player key={active.id} wt={active} pending={pending} onClose={() => setOpen(null)} onFinish={(m) => onDone(active.id, m)} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => setOpen(w.id)}
                className="flex h-full w-full items-start gap-3 rounded-xl border border-line px-4 py-3 text-left text-sm hover:border-line-strong hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <MousePointerClick aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <span className="flex-1">
                  <span className="block font-medium text-fg">{w.title} <span className="font-normal text-fg-subtle">· {w.screens.length} screens</span></span>
                  <span className="mt-0.5 line-clamp-2 block text-fg-muted">{w.summary}</span>
                </span>
                {w.done && <Badge tone="success">{w.misses === 0 ? "Done · no misses" : `Done · ${w.misses} miss${w.misses === 1 ? "" : "es"}`}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Player({ wt, onClose, onFinish, pending }: { wt: ClientWalkthrough; onClose: () => void; onFinish: (misses: number) => void; pending: boolean }) {
  const first = wt.screens[0];
  const [screenId, setScreenId] = useState(first.id);
  const [screenMisses, setScreenMisses] = useState(0);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [finished, setFinished] = useState(false);
  const live = useRef<HTMLParagraphElement>(null);
  const screen = wt.screens.find((x) => x.id === screenId) ?? first;
  const index = wt.screens.indexOf(screen);
  const reveal = screenMisses >= 2;
  // The target is placed over the frame, so it only exists once the frame has loaded.
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = loaded === screen.src;

  // Preload the next frame so advancing is instant.
  useEffect(() => {
    const n = wt.screens.find((x) => x.id === screen.next);
    if (n) new Image().src = n.src;
  }, [screen, wt.screens]);

  const hit = () => {
    setFeedback({ tone: "ok", text: screen.confirmation || "Correct." });
    if (screen.finish || !screen.next) {
      setFinished(true);
      onFinish(misses);
      return;
    }
    setScreenId(screen.next);
    setScreenMisses(0);
  };
  const miss = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ready) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const h = screen.hotspot;
    // A small tolerance so a click on the edge of a button counts.
    if (x >= h.x - 0.6 && x <= h.x + h.w + 0.6 && y >= h.y - 0.8 && y <= h.y + h.h + 0.8) return hit();
    setMisses((m) => m + 1);
    setScreenMisses((m) => m + 1);
    setFeedback({ tone: "miss", text: screen.hint });
  };
  const restart = () => {
    setScreenId(first.id);
    setScreenMisses(0);
    setMisses(0);
    setFeedback(null);
    setFinished(false);
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-line bg-surface-2/40 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-fg">{wt.title} · Screen {index + 1} of {wt.screens.length}</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={restart}><RotateCcw aria-hidden className="size-4" /> Restart</Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}><X aria-hidden className="size-4" /> Close</Button>
        </div>
      </div>
      {finished ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-success/40 bg-success-soft px-4 py-4 text-sm text-fg">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
          <div className="grid gap-2">
            <p className="font-semibold">{screen.confirmation || "Walkthrough complete."}</p>
            <p className="text-fg-muted">
              Finished with {misses === 0 ? "no wrong clicks" : `${misses} wrong click${misses === 1 ? "" : "s"}`}.{pending ? " Saving…" : " Saved to your progress."}
              {misses > 0 && " Run it again until you can do it without a miss."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={restart}><RotateCcw aria-hidden className="size-4" /> Run again</Button>
              <Button type="button" size="sm" onClick={onClose}>Back to walkthroughs</Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-fg"><span className="font-semibold">Do this:</span> {screen.instruction}</p>
          <div className="overflow-x-auto rounded-lg">
            {/* Click surface: the frame is a picture of the IMMIX screen. */}
            <div className="relative min-w-[720px] cursor-crosshair select-none" onClick={miss} data-testid="walkthrough-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={screen.src}
                src={screen.src}
                alt={`IMMIX screen: ${screen.instruction}`}
                draggable={false}
                onLoad={() => setLoaded(screen.src)}
                ref={(el) => { if (el?.complete && el.naturalWidth) setLoaded(screen.src); }}
                className="block aspect-[1920/908] h-auto w-full bg-black object-contain"
              />
              {ready && <button
                type="button"
                aria-label={`Target for: ${screen.instruction}`}
                onClick={(e) => { e.stopPropagation(); hit(); }}
                className={cn(
                  "absolute rounded-[3px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  reveal && "animate-pulse outline-3 outline-offset-1 outline-warning",
                )}
                style={{ left: `${screen.hotspot.x}%`, top: `${screen.hotspot.y}%`, width: `${screen.hotspot.w}%`, height: `${screen.hotspot.h}%` }}
              />}
            </div>
          </div>
          <p ref={live} aria-live="polite" className={cn("min-h-6 text-sm", feedback?.tone === "miss" ? "text-warning" : "text-success")}>
            {feedback ? (feedback.tone === "miss" ? `${feedback.text}${reveal ? " The target is now outlined." : ""}` : `✓ ${feedback.text}`) : ""}
          </p>
        </>
      )}
    </div>
  );
}

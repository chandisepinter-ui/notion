"use client";
/**
 * Titan how-to training videos for a module step. Installed videos play in
 * place (one open at a time); videos not installed on this computer say so.
 */
import { useState } from "react";
import { Film, Play, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type File = { name: string; approved: boolean; src: string | null };

const label = (name: string) => name.replace(/\.mp4$/i, "");

export function VideoList({ files }: { files: File[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const missing = files.filter((f) => !f.src).length;
  return (
    <>
      <ul className="mt-5 grid gap-2">
        {files.length === 0 && (
          <li className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-fg-muted"><Film aria-hidden className="size-4" /> No recording exists for this module yet.</li>
        )}
        {files.map((f) => (
          <li key={f.name} className="rounded-xl border border-line text-sm">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Film aria-hidden className="size-4 text-fg-subtle" />
              <span className="flex-1 text-fg">{label(f.name)}</span>
              {f.src ? (
                open === f.name ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(null)}><X aria-hidden className="size-4" /> Close video</Button>
                ) : (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(f.name)} aria-label={`Play ${label(f.name)}`}><Play aria-hidden className="size-4" /> Play</Button>
                )
              ) : (
                <Badge tone="planned">Not installed on this computer</Badge>
              )}
            </div>
            {f.src && open === f.name && (
              <div className="border-t border-line p-3">
                <video src={f.src} controls autoPlay preload="metadata" className="mx-auto aspect-video max-h-[70vh] w-full rounded-lg bg-black" aria-label={label(f.name)}>
                  Your browser cannot play this video.
                </video>
              </div>
            )}
          </li>
        ))}
      </ul>
      {missing > 0 && (
        <p className="mt-3 text-sm text-fg-subtle">
          {missing === files.length ? "These videos" : "Some videos"} are not installed on this computer yet. You can continue without them.
        </p>
      )}
    </>
  );
}

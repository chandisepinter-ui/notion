"use client";
/**
 * IMMIX camera image: a local camera still (owner-authorized Titan imagery)
 * with the camera's burned-in timestamp, IR treatment after dark, sensor grain,
 * and the scenario subject composited in. Falls back to the drawn scene when no
 * stills are installed on this computer.
 */
import { SimCamera, sceneFor } from "@/components/sim/SimCamera";

export type Media = { src: string; ir: boolean; night: boolean; aspect: number } | undefined;

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function stamp(cameraLabel: string, d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${cameraLabel} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} EDT`;
}

export function ImmixCamera({
  media,
  cameraLabel,
  siteId,
  when,
  subject,
  offSiteCamera,
  title,
  compact,
}: {
  media: Media;
  cameraLabel: string;
  siteId: string;
  when: Date;
  subject: { x: number; onSite: boolean; label: string } | null;
  offSiteCamera: boolean;
  title: string;
  compact?: boolean;
}) {
  if (!media) {
    return (
      <SimCamera
        scene={sceneFor(cameraLabel, siteId, offSiteCamera)}
        cameraLabel={cameraLabel}
        siteCode=""
        timeText={stamp(cameraLabel, when).slice(cameraLabel.length + 1)}
        subject={subject}
        title={title}
      />
    );
  }
  const h = subject ? (subject.onSite ? 0.36 : 0.15) : 0;
  const bottom = subject ? (subject.onSite ? 0.9 : 0.6) : 0;
  const person = media.night ? "#cfcfcf" : "#2a2a2a";
  return (
    <div className="relative mx-auto h-full w-full overflow-hidden bg-black" style={{ aspectRatio: String(media.aspect) }} role="img" aria-label={`${title}. ${subject ? subject.label || "A person is visible." : "No one is visible."}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.src}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover"
        style={{ filter: media.ir ? "grayscale(1) contrast(1.3) brightness(0.82)" : "saturate(0.92)" }}
      />
      {subject && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <filter id="immix-soft"><feGaussianBlur stdDeviation="0.55" /></filter>
          </defs>
          <g
            filter="url(#immix-soft)"
            opacity={media.night ? 0.78 : 0.8}
            transform={`translate(${8 + subject.x * 84} ${bottom * 100}) scale(${(h * 100) / 100 / media.aspect} ${h})`}
          >
            {/* person silhouette, unit height 100 */}
            <ellipse cx="0" cy="-90" rx="7" ry="9" fill={person} />
            <path d="M-11 -78 Q0 -84 11 -78 L13 -42 L8 -40 L7 0 L1 0 L0 -38 L-1 0 L-7 0 L-8 -40 L-13 -42 Z" fill={person} />
            <path d="M-11 -76 L-17 -46 L-13 -45 L-8 -70 Z M11 -76 L17 -46 L13 -45 L8 -70 Z" fill={person} />
          </g>
        </svg>
      )}
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay animate-[immix-grain_0.5s_steps(2)_infinite]" style={{ backgroundImage: GRAIN }} aria-hidden />
      <p
        className="pointer-events-none absolute left-[2%] top-[1.5%] whitespace-nowrap text-white"
        style={{ fontFamily: "Consolas, 'Lucida Console', monospace", fontSize: compact ? "6px" : "clamp(8px, 0.85vw, 14px)", letterSpacing: "0.06em", textShadow: "0 0 2px #000, 0 0 2px #000" }}
        aria-hidden
      >
        {stamp(cameraLabel, when)}
      </p>
    </div>
  );
}

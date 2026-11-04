"use client";
/**
 * IMMIX camera image: a local camera still (owner-authorized Titan imagery)
 * with the camera's burned-in timestamp, IR treatment after dark, sensor grain,
 * and the scenario subject composited in. Falls back to the drawn scene when no
 * stills are installed on this computer.
 *
 * Footage is generated procedurally (no AI, no video files) so it always matches
 * the scenario exactly: an articulated figure walks the scenario's positions,
 * rendered at a CCTV frame rate with motion blur, ground shadow, IR treatment
 * after dark and, on alarm clips, the analytics box IMMIX draws around a detection.
 */
import { useEffect, useRef, useState } from "react";
import { SimCamera, sceneFor } from "@/components/sim/SimCamera";

export type Media = { src: string; ir: boolean; night: boolean; aspect: number } | undefined;

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function stamp(cameraLabel: string, d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${cameraLabel} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} EDT`;
}

export type CameraSubject = {
  x: number;
  onSite: boolean;
  label: string;
  /** Clip playback: walking direction (-1 left, 1 right, 0 standing) and clip time driving the stride. */
  heading?: -1 | 0 | 1;
  gaitT?: number;
};

const FPS = 12; // typical recorder frame rate: motion steps, it does not glide
const WALK_SPEED = 0.07; // frame widths per second when a live subject changes position
const STRIDE_HZ = 0.95;

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

/**
 * Live views receive a new position a few times a second; walk the figure there
 * at walking speed instead of teleporting. Clip playback (gaitT set) is used as-is.
 */
function useLiveMotion(subject: CameraSubject | null, still: boolean) {
  const [st, setSt] = useState<{ x: number; heading: -1 | 0 | 1; t: number } | null>(null);
  const target = useRef(subject);
  target.current = subject;
  const live = !!subject && subject.gaitT === undefined;
  useEffect(() => {
    if (!live) { setSt(null); return; }
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      setSt((p) => {
        const goal = target.current?.x ?? 0.5;
        if (!p || still) return { x: goal, heading: 0, t: now / 1000 };
        const d = goal - p.x;
        const step = WALK_SPEED * dt;
        if (Math.abs(d) <= step) return { x: goal, heading: 0, t: now / 1000 };
        return { x: p.x + Math.sign(d) * step, heading: d > 0 ? 1 : -1, t: now / 1000 };
      });
    }, 1000 / FPS);
    return () => clearInterval(id);
  }, [live, still]);
  return live ? st : null;
}

/** Articulated walker, unit height 100, feet at y=0. */
function Figure({ phase, moving, color, facing }: { phase: number; moving: boolean; color: { skin: string; top: string; legs: string }; facing: 1 | -1 }) {
  const w = 2 * Math.PI * phase;
  const swing = moving ? 24 : 0;
  const thighA = swing * Math.sin(w);
  const thighB = -thighA;
  const knee = (a: number, ph: number) => (moving ? Math.max(0, Math.sin(ph)) * 32 : 0);
  const kneeA = knee(thighA, w + Math.PI / 2);
  const kneeB = knee(thighB, w - Math.PI / 2);
  const bob = moving ? -1.6 * Math.abs(Math.cos(w)) : 0;
  const sway = moving ? 0 : 0.6 * Math.sin(phase * 0.9); // standing people shift weight
  const leg = (a: number, k: number, key: string) => {
    const r = (d: number) => (d * Math.PI) / 180;
    const hip = { x: 0, y: -48 + bob };
    const kneeP = { x: hip.x + 24 * Math.sin(r(a)), y: hip.y + 24 * Math.cos(r(a)) };
    const foot = { x: kneeP.x + 24 * Math.sin(r(a - k)), y: kneeP.y + 24 * Math.cos(r(a - k)) };
    return <path key={key} d={`M${hip.x} ${hip.y} L${kneeP.x} ${kneeP.y} L${foot.x} ${foot.y} l${4 * facing} 0`} stroke={color.legs} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  };
  const arm = (a: number, key: string) => {
    const r = (d: number) => (d * Math.PI) / 180;
    const sh = { x: 0, y: -79 + bob };
    const el = { x: sh.x + 17 * Math.sin(r(a)), y: sh.y + 17 * Math.cos(r(a)) };
    const hand = { x: el.x + 16 * Math.sin(r(a + (moving ? 18 : 6))), y: el.y + 16 * Math.cos(r(a + (moving ? 18 : 6))) };
    return <path key={key} d={`M${sh.x} ${sh.y} L${el.x} ${el.y} L${hand.x} ${hand.y}`} stroke={color.top} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  };
  return (
    <g transform={`translate(${sway} 0) scale(${facing} 1)`}>
      {leg(thighB, kneeB, "lb")}
      {arm(-0.8 * thighB, "ab")}
      <path d={`M-9 ${-82 + bob} Q0 ${-87 + bob} 9 ${-82 + bob} L8 ${-47 + bob} L-8 ${-47 + bob} Z`} fill={color.top} />
      <ellipse cx={1.5} cy={-91 + bob} rx={6.2} ry={7.6} fill={color.skin} />
      {leg(thighA, kneeA, "la")}
      {arm(-0.8 * thighA, "aa")}
    </g>
  );
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
  analytics,
}: {
  media: Media;
  cameraLabel: string;
  siteId: string;
  when: Date;
  subject: CameraSubject | null;
  offSiteCamera: boolean;
  title: string;
  compact?: boolean;
  /** Alarm clips: draw the analytics detection box around the subject. */
  analytics?: boolean;
}) {
  const reduced = useReducedMotion();
  const liveState = useLiveMotion(media ? subject : null, reduced);
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
  // Position and stride for this frame, stepped at the recorder frame rate.
  const clipT = subject?.gaitT !== undefined ? Math.floor(subject.gaitT * FPS) / FPS : undefined;
  const x = liveState ? liveState.x : subject?.x ?? 0.5;
  const heading = reduced ? 0 : liveState ? liveState.heading : subject?.heading ?? 0;
  const t = clipT ?? liveState?.t ?? 0;
  const moving = heading !== 0;
  const facing: 1 | -1 = heading < 0 ? -1 : 1;
  const phase = moving ? t * STRIDE_HZ : t * 0.15;

  const h = subject ? (subject.onSite ? 0.36 : 0.15) : 0;
  const bottom = subject ? (subject.onSite ? 0.9 : 0.6) : 0;
  // Under IR, skin and fabric reflect differently; by day clothing reads darker than skin.
  const person = media.night ? { skin: "#c9c9c9", top: "#a8a8a8", legs: "#7c7c7c" } : { skin: "#6b5547", top: "#2f3338", legs: "#1d1f24" };
  const cx = 8 + x * 84;
  const sx = h / media.aspect; // keep the figure's proportions in the stretched 100x100 viewBox
  const blur = moving ? `${(0.9 * h) / 0.36} 0.35` : "0.45";
  const boxW = (h * 100 * 0.42) / media.aspect;
  return (
    <div className="flex h-full w-full items-center justify-center bg-black [container-type:size]">
    {/* Fit the whole picture inside the pane at its true aspect ratio (no cropping of the burned-in timestamp). */}
    <div className="relative overflow-hidden bg-black" style={{ aspectRatio: String(media.aspect), width: `min(100cqw, ${(media.aspect * 100).toFixed(3)}cqh)` }} role="img" aria-label={`${title}. ${subject ? subject.label || "A person is visible." : "No one is visible."}`}>
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
            <filter id={`immix-blur-${moving ? "m" : "s"}`} x="-50%" y="-20%" width="200%" height="140%">
              <feGaussianBlur stdDeviation={blur} />
            </filter>
            <radialGradient id="immix-shadow">
              <stop offset="0" stopColor="#000" stopOpacity={media.night ? 0.28 : 0.45} />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx={cx + (media.night ? 0 : 1.2 * sx * 10)} cy={bottom * 100} rx={sx * 22} ry={h * 3.2} fill="url(#immix-shadow)" />
          <g filter={`url(#immix-blur-${moving ? "m" : "s"})`} opacity={media.night ? 0.82 : 0.84} transform={`translate(${cx} ${bottom * 100}) scale(${sx} ${h})`}>
            <Figure phase={phase} moving={moving} color={person} facing={facing} />
          </g>
          {analytics && (
            <rect x={cx - boxW / 2} y={bottom * 100 - h * 104} width={boxW} height={h * 108} fill="none" stroke="#e01b1b" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          )}
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
    </div>
  );
}

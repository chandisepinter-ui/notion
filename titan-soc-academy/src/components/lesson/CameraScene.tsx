/**
 * Simulated infrared camera image, drawn entirely in SVG from scenario data.
 * No photos or real footage are used. Colors are fixed (an IR camera looks the
 * same in light and dark mode).
 */
import { createContext, useContext, useId } from "react";
import type { SceneFrame, SceneKind, SceneObject } from "@/lib/academy/types";

const IdCtx = createContext("s");
const usePatternUrl = (name: string) => `url(#${useContext(IdCtx)}-${name})`;

const IR = {
  deep: "#121812",
  base: "#1a221b",
  mid: "#243026",
  light: "#33413a",
  line: "#4b5c50",
  bright: "#c9d6c4",
  glow: "#e9f2df",
  vest: "#eef7a8",
};

function Background({ kind }: { kind: SceneKind }) {
  const chain = usePatternUrl("chain");
  const gravel = usePatternUrl("gravel");
  switch (kind) {
    case "fence":
      return (
        <g>
          <rect width="640" height="132" fill={IR.deep} />
          <rect y="118" width="640" height="34" fill={IR.base} />
          <rect y="150" width="640" height="36" fill={IR.mid} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line key={i} x1={i * 90} y1="150" x2={i * 90 - 10} y2="186" stroke={IR.line} strokeOpacity="0.4" />
          ))}
          {[90, 560].map((x) => (
            <g key={x}>
              <rect x={x} y="40" width="4" height="112" fill={IR.line} />
              <circle cx={x + 2} cy="42" r="26" fill={IR.glow} opacity="0.08" />
              <circle cx={x + 2} cy="42" r="5" fill={IR.glow} opacity="0.7" />
            </g>
          ))}
          <rect y="186" width="640" height="174" fill={IR.base} />
          <rect y="186" width="640" height="174" fill={gravel} opacity="0.55" />
          <rect y="110" width="640" height="80" fill={chain} opacity="0.5" />
          <line x1="0" y1="111" x2="640" y2="111" stroke={IR.bright} strokeOpacity="0.55" strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x={i * 58 + 10} y="108" width="3" height="84" fill={IR.bright} opacity="0.5" />
          ))}
        </g>
      );
    case "gate":
      return (
        <g>
          <rect width="640" height="360" fill={IR.base} />
          <rect width="640" height="150" fill={IR.deep} />
          <rect y="150" width="640" height="70" fill={IR.mid} />
          <polygon points="250,220 410,220 560,360 100,360" fill={IR.light} opacity="0.7" />
          <rect x="0" y="150" width="250" height="72" fill={chain} opacity="0.5" />
          <rect x="410" y="150" width="230" height="72" fill={chain} opacity="0.5" />
          <line x1="0" y1="151" x2="640" y2="151" stroke={IR.bright} strokeOpacity="0.5" strokeWidth="2" />
          <rect x="244" y="138" width="7" height="86" fill={IR.bright} opacity="0.75" />
          <rect x="409" y="138" width="7" height="86" fill={IR.bright} opacity="0.75" />
          <polygon points="251,152 205,160 205,224 251,222" fill={chain} opacity="0.8" />
          <polygon points="416,152 462,160 462,224 416,222" fill={chain} opacity="0.8" />
          <text x="330" y="134" textAnchor="middle" fill={IR.bright} opacity="0.55" fontSize="11" fontFamily="monospace">GATE B</text>
          <rect x="500" y="40" width="140" height="210" fill={IR.mid} />
          {[0, 1, 2].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={520 + c * 56} y={64 + r * 52} width="34" height="26" fill={IR.deep} stroke={IR.line} />))}
          <circle cx="330" cy="70" r="40" fill={IR.glow} opacity="0.05" />
        </g>
      );
    case "dock":
      return (
        <g>
          <rect width="640" height="240" fill={IR.mid} />
          {[60, 250, 440].map((x, i) => (
            <g key={x}>
              <rect x={x} y="70" width="140" height="162" fill={IR.base} stroke={IR.line} />
              {Array.from({ length: 9 }).map((_, j) => (
                <line key={j} x1={x} y1={88 + j * 16} x2={x + 140} y2={88 + j * 16} stroke={IR.line} strokeOpacity="0.6" />
              ))}
              <rect x={x + 55} y="44" width="30" height="8" fill={IR.glow} opacity="0.8" />
              <ellipse cx={x + 70} cy="90" rx="80" ry="60" fill={IR.glow} opacity="0.05" />
              <text x={x + 70} y="64" textAnchor="middle" fill={IR.bright} opacity="0.6" fontSize="11" fontFamily="monospace">DOOR {i + 1}</text>
            </g>
          ))}
          <rect y="232" width="640" height="128" fill={IR.base} />
          <rect y="232" width="640" height="10" fill={IR.light} />
          {Array.from({ length: 16 }).map((_, i) => (
            <rect key={i} x={i * 42} y="234" width="20" height="6" fill={IR.bright} opacity="0.35" />
          ))}
          <rect y="242" width="640" height="118" fill={gravel} opacity="0.25" />
        </g>
      );
    case "lot":
      return (
        <g>
          <rect width="640" height="360" fill={IR.base} />
          <rect width="640" height="120" fill={IR.deep} />
          <rect y="112" width="640" height="40" fill={chain} opacity="0.4" />
          {[120, 520].map((x) => (
            <g key={x}>
              <rect x={x} y="30" width="4" height="150" fill={IR.line} />
              <circle cx={x + 2} cy="32" r="30" fill={IR.glow} opacity="0.07" />
              <circle cx={x + 2} cy="32" r="5" fill={IR.glow} opacity="0.7" />
            </g>
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <Car key={`a${i}`} x={30 + i * 78} y={190} s={0.55} />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <Car key={`b${i}`} x={20 + i * 108} y={250} s={0.8} />
          ))}
          <rect y="262" width="640" height="98" fill={IR.mid} opacity="0.6" />
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={i * 68} y="318" width="36" height="3" fill={IR.bright} opacity="0.25" />
          ))}
          <text x="14" y="176" fill={IR.bright} opacity="0.5" fontSize="10" fontFamily="monospace">ROW A</text>
          <text x="14" y="236" fill={IR.bright} opacity="0.5" fontSize="10" fontFamily="monospace">ROW B</text>
        </g>
      );
  }
}

function Car({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 h88 v-16 l-14 -14 h-50 l-14 14 h-10 z" fill={IR.light} stroke={IR.line} />
      <rect x="28" y="-27" width="18" height="10" fill={IR.deep} />
      <rect x="50" y="-27" width="18" height="10" fill={IR.deep} />
      <circle cx="18" cy="0" r="8" fill={IR.deep} />
      <circle cx="70" cy="0" r="8" fill={IR.deep} />
    </g>
  );
}

/** Returns approximate bounding box for the detection overlay. */
function bounds(o: SceneObject): { x: number; y: number; w: number; h: number } | null {
  const s = "scale" in o && o.scale ? o.scale : 1;
  switch (o.type) {
    case "person":
      return { x: o.x - 18 * s, y: o.y - 92 * s, w: 36 * s, h: 94 * s };
    case "animal":
      return o.species === "deer" ? { x: o.x - 40 * s, y: o.y - 70 * s, w: 82 * s, h: 72 * s } : { x: o.x - 26 * s, y: o.y - 22 * s, w: 56 * s, h: 24 * s };
    case "vehicle":
      return { x: o.x - 6 * s, y: o.y - 78 * s, w: 232 * s, h: 82 * s };
    case "debris":
      return { x: o.x - 14 * s, y: o.y - 14 * s, w: 28 * s, h: 26 * s };
    default:
      return null;
  }
}

function SceneObj({ o }: { o: SceneObject }) {
  const s = "scale" in o && o.scale ? o.scale : 1;
  const flip = "facing" in o && o.facing === "left" ? -1 : 1;
  switch (o.type) {
    case "person":
      return (
        <g transform={`translate(${o.x} ${o.y}) scale(${s * flip} ${s})`}>
          <ellipse cx="0" cy="1" rx="16" ry="4" fill="#000" opacity="0.35" />
          <rect x="-8" y="-40" width="7" height="40" rx="3" fill={IR.bright} />
          <rect x="2" y="-40" width="7" height="40" rx="3" fill={IR.bright} transform="rotate(-6 5 -40)" />
          <rect x="-11" y="-76" width="22" height="40" rx="6" fill={IR.bright} />
          {o.vest && (
            <g>
              <rect x="-11" y="-74" width="22" height="34" rx="5" fill={IR.vest} />
              <rect x="-11" y="-62" width="22" height="3" fill="#ffffff" />
              <rect x="-11" y="-52" width="22" height="3" fill="#ffffff" />
            </g>
          )}
          <rect x="9" y="-72" width="6" height="30" rx="3" fill={IR.bright} transform="rotate(-14 12 -72)" />
          <rect x="-15" y="-72" width="6" height="30" rx="3" fill={IR.bright} transform="rotate(10 -12 -72)" />
          <circle cx="2" cy="-84" r="8" fill={IR.glow} />
        </g>
      );
    case "animal":
      if (o.species === "deer")
        return (
          <g transform={`translate(${o.x} ${o.y}) scale(${s * flip} ${s})`}>
            <ellipse cx="0" cy="1" rx="34" ry="4" fill="#000" opacity="0.35" />
            {[-24, -16, 16, 24].map((lx) => (
              <rect key={lx} x={lx} y="-30" width="4" height="30" fill={IR.bright} />
            ))}
            <ellipse cx="0" cy="-38" rx="32" ry="14" fill={IR.bright} />
            <path d="M24 -44 L34 -62 L40 -60 L32 -40 Z" fill={IR.bright} />
            <ellipse cx="38" cy="-63" rx="9" ry="5" fill={IR.glow} />
            <path d="M34 -67 l-4 -8 M40 -67 l4 -8" stroke={IR.bright} strokeWidth="2" />
          </g>
        );
      return (
        <g transform={`translate(${o.x} ${o.y}) scale(${s * flip} ${s})`}>
          <ellipse cx="0" cy="1" rx="18" ry="3" fill="#000" opacity="0.35" />
          <ellipse cx="0" cy="-10" rx="17" ry="9" fill={IR.bright} />
          <circle cx="17" cy="-12" r="6" fill={IR.glow} />
          <path d="M-16 -10 q-12 -2 -12 -10" stroke={IR.bright} strokeWidth="5" fill="none" strokeDasharray="3 2" />
          {[-10, -3, 6, 12].map((lx) => (
            <rect key={lx} x={lx} y="-4" width="3" height="5" fill={IR.bright} />
          ))}
        </g>
      );
    case "vehicle":
      return (
        <g transform={`translate(${o.x} ${o.y}) scale(${s} ${s})`}>
          <ellipse cx="110" cy="2" rx="118" ry="6" fill="#000" opacity="0.35" />
          <rect x="0" y="-38" width="160" height="12" fill={IR.light} stroke={IR.line} />
          {o.loaded && <Car x={30} y={-38} s={1.1} />}
          <path d="M160 -60 h40 l18 22 v30 h-58 z" fill={IR.bright} />
          <rect x="176" y="-56" width="20" height="16" fill={IR.deep} />
          {o.label && (
            <text x="186" y="-20" textAnchor="middle" fontSize="8" fontWeight="700" fill={IR.deep} fontFamily="monospace">
              {o.label}
            </text>
          )}
          <rect x="0" y="-26" width="220" height="14" fill={IR.mid} />
          {[30, 120, 190].map((cx) => (
            <circle key={cx} cx={cx} cy="-6" r="10" fill={IR.deep} stroke={IR.line} />
          ))}
          <circle cx="216" cy="-34" r="5" fill={IR.glow} />
        </g>
      );
    case "debris":
      return (
        <g transform={`translate(${o.x} ${o.y}) scale(${s})`}>
          <path d="M-10 -6 q8 -12 18 -4 q6 8 -2 14 q-10 6 -16 -2 z" fill={IR.glow} opacity="0.85" />
        </g>
      );
    case "rain":
      return (
        <g opacity="0.55">
          <rect width="640" height="360" fill={IR.glow} opacity="0.06" />
          {Array.from({ length: 90 }).map((_, i) => {
            const x = (i * 73) % 660;
            const y = (i * 41) % 360;
            return <line key={i} x1={x} y1={y} x2={x - 8} y2={y + 26} stroke={IR.glow} strokeWidth="1.2" />;
          })}
        </g>
      );
  }
}

const LABEL: Record<string, string> = { person: "PERSON", animal: "MOTION", vehicle: "VEHICLE", debris: "MOTION" };

export function CameraScene({
  scene,
  frame,
  overlayTop,
  overlayBottom,
  title,
}: {
  scene: SceneKind;
  frame: SceneFrame;
  overlayTop: string;
  overlayBottom: string;
  title: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <IdCtx.Provider value={uid}>
    <svg viewBox="0 0 640 360" className="block h-auto w-full" role="img" aria-label={`${title}. ${frame.caption}`}>
      <defs>
        <pattern id={`${uid}-chain`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke={IR.bright} strokeOpacity="0.35" strokeWidth="1" />
          <line x1="0" y1="0" x2="10" y2="0" stroke={IR.bright} strokeOpacity="0.35" strokeWidth="1" />
        </pattern>
        <pattern id={`${uid}-gravel`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r="0.9" fill={IR.bright} opacity="0.35" />
          <circle cx="10" cy="11" r="0.7" fill={IR.bright} opacity="0.25" />
        </pattern>
        <radialGradient id={`${uid}-vignette`} cx="50%" cy="50%" r="75%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
      </defs>
      <Background kind={scene} />
      {[...frame.objects].sort((a, b) => ("y" in a ? a.y : 0) - ("y" in b ? b.y : 0)).map((o, i) => (
        <SceneObj key={i} o={o} />
      ))}
      {frame.objects.filter((o) => o.track).map((o, i) => {
        const b = bounds(o);
        if (!b) return null;
        return (
          <g key={`box${i}`}>
            <rect x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} fill="none" stroke="#ffd34d" strokeWidth="1.5" strokeDasharray="10 5" />
            <rect x={b.x - 4} y={b.y - 18} width={LABEL[o.type].length * 7 + 10} height="14" fill="#ffd34d" />
            <text x={b.x + 1} y={b.y - 8} fontSize="10" fontWeight="700" fontFamily="monospace" fill="#151a12">
              {LABEL[o.type]}
            </text>
          </g>
        );
      })}
      <rect width="640" height="360" fill={`url(#${uid}-vignette)`} />
      <g fontFamily="monospace" fontSize="12" fill="#e8f1e0">
        <rect x="8" y="8" width={overlayTop.length * 7.4 + 30} height="20" fill="#000" opacity="0.45" />
        <circle cx="19" cy="18" r="4" fill="#ff5a4f" />
        <text x="29" y="22">{overlayTop}</text>
        <rect x="8" y="332" width={overlayBottom.length * 7.4 + 12} height="20" fill="#000" opacity="0.45" />
        <text x="14" y="346">{overlayBottom}</text>
      </g>
    </svg>
    </IdCtx.Provider>
  );
}

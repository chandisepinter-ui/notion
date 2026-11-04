"use client";
/** Renders a simulated camera image (event clip frame or live view) with the shared SVG scene renderer. */
import { CameraScene } from "@/components/lesson/CameraScene";
import type { SceneKind, SceneObject } from "@/lib/academy/types";

const KINDS: SceneKind[] = ["gate", "dock", "lot", "fence"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Cameras that ever show off-site activity use the fence scene (so "beyond the fence" is visible). */
export function sceneFor(cameraId: string, siteId: string, offSiteCamera: boolean): SceneKind {
  if (offSiteCamera) return "fence";
  return KINDS[hash(`${siteId}:${cameraId}`) % KINDS.length];
}

export function subjectObject(x: number, onSite: boolean, label: string, scene: SceneKind): SceneObject {
  const px = 40 + Math.max(0, Math.min(1, x)) * 560;
  const vest = /vest/i.test(label);
  if (scene === "fence" && !onSite) return { type: "person", x: px, y: 176, scale: 0.55, vest, track: true };
  if (scene === "dock") return { type: "person", x: px, y: 255, scale: 0.85, vest, track: true };
  return { type: "person", x: px, y: 300, scale: 0.95, vest, track: true };
}

export function SimCamera({
  scene,
  cameraLabel,
  siteCode,
  timeText,
  subject,
  failed,
  title,
}: {
  scene: SceneKind;
  cameraLabel: string;
  siteCode: string;
  timeText: string;
  subject: { x: number; onSite: boolean; label: string } | null;
  failed?: boolean;
  title: string;
}) {
  if (failed) {
    return (
      <div className="grid aspect-video w-full place-items-center bg-black text-center font-mono text-sm text-[#e8f1e0]" role="img" aria-label={`${title}: no connection`}>
        <div>
          <p className="text-base">CONNECTION FAILED</p>
          <p className="mt-1 text-xs opacity-70">{cameraLabel} · ping failed</p>
        </div>
      </div>
    );
  }
  return (
    <CameraScene
      scene={scene}
      frame={{
        time: timeText,
        objects: subject ? [subjectObject(subject.x, subject.onSite, subject.label, scene)] : [],
        caption: subject ? subject.label || "A person is visible." : "No one is visible.",
      }}
      overlayTop={`${siteCode} ${cameraLabel}`}
      overlayBottom={timeText}
      title={title}
    />
  );
}

import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SimScenario } from "./types";

/**
 * Assigns local camera stills (content-import/media/immix) to scenario cameras.
 * Owner-authorized Titan imagery, stored only on this computer.
 *
 * stills.json lists each still with its real camera "scene" (several stills can
 * be the same camera) and whether it looks onto a road/sidewalk. Each camera at a
 * site gets a different scene; cameras the site notes describe as looking onto
 * a public sidewalk/street get the road view.
 * Optional cameras.json overrides: { "SITE-ID/CAM 01": "file.jpg" }.
 */
type Still = { file: string; w: number; h: number; night: boolean; scene: string; roadView?: boolean };
const DIR = path.join(process.cwd(), "content-import", "media", "immix");

export type CameraMedia = Record<string, { src: string; ir: boolean; night: boolean; aspect: number }>;

function looksOffSite(site: SimScenario["sites"][number], camId: string) {
  const text = [site.boundary ?? "", ...site.notes].join(". ");
  return text
    .split(/(?<=[.;])\s+/)
    .some((sentence) => sentence.includes(camId) && /sidewalk|public|street|road|right-of-way/i.test(sentence));
}

export function mediaForScenario(s: SimScenario): CameraMedia | null {
  if (process.env.TITAN_CONTENT === "off") return null;
  const idx = path.join(DIR, "stills.json");
  if (!existsSync(idx)) return null;
  const stills = (JSON.parse(readFileSync(idx, "utf8")) as { stills: Still[] }).stills;
  if (!stills.length) return null;
  const overrides = existsSync(path.join(DIR, "cameras.json")) ? (JSON.parse(readFileSync(path.join(DIR, "cameras.json"), "utf8")) as Record<string, string>) : {};
  const hour = Number(s.startLocal.slice(11, 13));
  const night = hour >= 18 || hour < 7; // cameras switch to IR after dark
  const offSiteFromClips = new Set(s.alerts.filter((a) => Object.values(a.clips ?? {}).some((c) => c?.beats.some((b) => !b.onSite))).map((a) => a.cameraId));
  const alertCams = new Set(s.alerts.map((a) => a.cameraId));
  const road = stills.find((x) => x.roadView);
  // Best-quality still per scene, larger first; night scenes first after dark.
  const scenes = new Map<string, Still>();
  for (const x of [...stills].sort((a, b) => b.w * b.h - a.w * a.h)) if (!scenes.has(x.scene)) scenes.set(x.scene, x);
  const ordered = [...scenes.values()].filter((x) => x !== road).sort((a, b) => Number(night && b.night) - Number(night && a.night) || b.w - a.w);
  const out: CameraMedia = {};
  for (const site of s.sites) {
    const used = new Set<string>();
    const take = (x: Still) => { used.add(x.scene); return x; };
    // Alert cameras first so they get the best stills.
    const cams = [...site.cameras].sort((a, b) => Number(alertCams.has(b.id)) - Number(alertCams.has(a.id)));
    for (const cam of cams) {
      const key = `${site.id}/${cam.id}`;
      let pick = overrides[key] ? stills.find((x) => x.file === overrides[key]) : undefined;
      if (!pick && road && !used.has(road.scene) && (offSiteFromClips.has(cam.id) || looksOffSite(site, cam.id))) pick = road;
      if (!pick) pick = ordered.find((x) => !used.has(x.scene)) ?? ordered[0];
      take(pick);
      out[cam.id] = { src: `/api/media/immix/${pick.file}`, ir: night && !pick.night, night, aspect: pick.w / pick.h };
    }
  }
  return out;
}

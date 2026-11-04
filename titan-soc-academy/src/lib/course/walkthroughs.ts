import "server-only";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseWalkthroughs, type Walkthrough, type WalkthroughRow } from "./walkthrough-model";

export { FRAME_NAME, type Walkthrough } from "./walkthrough-model";

/**
 * Guided IMMIX walkthroughs — the click-through screen sequences from the Titan
 * Power Apps Academy build (OneDrive: SOC Academy/titan-soc-academy/simulator/
 * scenario_assets). The frames and manifest.json are stored only on this
 * computer in content-import/media/walkthroughs (git-ignored).
 *
 * manifest.json rows: { AppID, ScreenID, File, Notes: "instruction||wrong-click hint",
 *   Title: "confirmation", XPct, YPct, WidthPct, HeightPct, ActionKey: NEXT|FINISH, TargetScreenID }
 * AppID "D2M02.A" belongs to module D2M02.
 *
 * These are guided (GUIDE stage) practice: ungraded, so the hotspot is sent to
 * the browser, exactly as the Power Apps version worked.
 */
export const WALKTHROUGH_DIR = path.join(process.cwd(), "content-import", "media", "walkthroughs");

let cache: { mtime: string; byModule: Map<string, Walkthrough[]> } | null = null;

export function walkthroughsFor(moduleKey: string): Walkthrough[] {
  if (process.env.TITAN_CONTENT === "off") return [];
  const file = path.join(WALKTHROUGH_DIR, "manifest.json");
  if (!existsSync(file)) return [];
  // Frames can be added after the manifest; the folder's mtime changes when they are.
  const mtime = `${statSync(file).mtimeMs}:${statSync(WALKTHROUGH_DIR).mtimeMs}`;
  if (!cache || cache.mtime !== mtime) {
    let rows: WalkthroughRow[] = [];
    try {
      rows = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      rows = [];
    }
    cache = { mtime, byModule: parseWalkthroughs(Array.isArray(rows) ? rows : [], (f) => existsSync(path.join(WALKTHROUGH_DIR, f))) };
  }
  return cache.byModule.get(moduleKey) ?? [];
}

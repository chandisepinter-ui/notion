/**
 * Guided walkthrough model (pure; unit-tested). See walkthroughs.ts for the loader.
 */
export type WalkthroughScreen = {
  id: string;
  file: string;
  instruction: string;
  hint: string;
  confirmation: string;
  hotspot: { x: number; y: number; w: number; h: number };
  finish: boolean;
  next: string | null;
};
export type Walkthrough = { id: string; moduleKey: string; title: string; summary: string; screens: WalkthroughScreen[] };

/** A line that tells walkthroughs apart: the first instruction, or the scenario line from the next screen when the first is generic. */
export function summarize(screens: WalkthroughScreen[]): string {
  const pick = screens.find((x) => !/^(Look at the alarm \(clip and live view\)\. Then open the Notes tab|Watch the alarm clip)/i.test(x.instruction)) ?? screens[0];
  const text = pick.instruction.replace(/^Read the site notes\.\s*/i, "").replace(/\s*Click Close Event\.?$/i, "").trim();
  return text || screens[0].instruction;
}

export const FRAME_NAME = /^Sim - [A-Za-z0-9-]{1,24}\.(jpg|jpeg|png)$/;

export type WalkthroughRow = { AppID: string; ScreenID: string; File: string; Notes: string; Title: string; XPct: number; YPct: number; WidthPct: number; HeightPct: number; ActionKey: string; TargetScreenID: string };

export function parseWalkthroughs(rows: WalkthroughRow[], hasFile: (f: string) => boolean): Map<string, Walkthrough[]> {
  const byApp = new Map<string, WalkthroughRow[]>();
  for (const r of rows) {
    if (!r?.AppID || !r.ScreenID || !FRAME_NAME.test(r.File ?? "")) continue;
    byApp.set(r.AppID, [...(byApp.get(r.AppID) ?? []), r]);
  }
  const byModule = new Map<string, Walkthrough[]>();
  for (const [app, list] of byApp) {
    const moduleKey = app.split(".")[0];
    const screens: WalkthroughScreen[] = list.map((r) => {
      const [instruction, hint] = String(r.Notes ?? "").split("||");
      return {
        id: r.ScreenID,
        file: r.File,
        instruction: (instruction ?? "").trim(),
        hint: (hint ?? "").trim() || "Not there. Read the instruction again.",
        confirmation: String(r.Title ?? "").trim(),
        hotspot: { x: +r.XPct, y: +r.YPct, w: +r.WidthPct, h: +r.HeightPct },
        finish: r.ActionKey === "FINISH",
        next: r.TargetScreenID || null,
      };
    });
    // Only offer a walkthrough when every frame it needs is on this computer and the chain is intact.
    const ids = new Set(screens.map((s) => s.id));
    const complete = screens.every((s) => hasFile(s.file) && (s.finish || (s.next !== null && ids.has(s.next))));
    if (!complete || !screens.some((s) => s.finish)) continue;
    const wt: Walkthrough = { id: app, moduleKey, title: "", summary: summarize(screens), screens };
    byModule.set(moduleKey, [...(byModule.get(moduleKey) ?? []), wt]);
  }
  for (const list of byModule.values()) list.forEach((w, i) => (w.title = `Walkthrough ${i + 1}`));
  return byModule;
}


/**
 * npm run media:walkthroughs -- "<path to scenario_assets>"
 *
 * Installs the guided IMMIX walkthroughs from the Titan Power Apps Academy build.
 * Point it at the synced OneDrive folder, e.g.
 *   "%USERPROFILE%\OneDrive - Titan Protection & Consulting\SOC Academy\titan-soc-academy\simulator\scenario_assets"
 * Copies manifest.json and the "Sim - *.jpg" frames it lists into
 * content-import/media/walkthroughs/ (git-ignored, stored only on this computer).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const src = process.argv[2];
const OUT = "content-import/media/walkthroughs";
if (!src || !existsSync(path.join(src, "manifest.json"))) {
  console.error('✖ Give the scenario_assets folder that contains manifest.json:\n  npm run media:walkthroughs -- "C:\\...\\scenario_assets"');
  process.exit(1);
}
const rows = JSON.parse(readFileSync(path.join(src, "manifest.json"), "utf8"));
const files = [...new Set(rows.map((r) => r.File))].filter((f) => /^Sim - [A-Za-z0-9-]{1,24}\.(jpg|jpeg|png)$/.test(f));
mkdirSync(OUT, { recursive: true });
const missing = [];
for (const f of files) {
  if (existsSync(path.join(src, f))) copyFileSync(path.join(src, f), path.join(OUT, f));
  else missing.push(f);
}
copyFileSync(path.join(src, "manifest.json"), path.join(OUT, "manifest.json"));
const apps = new Set(rows.map((r) => r.AppID)).size;
console.log(`✔ ${files.length - missing.length} frames, ${apps} walkthroughs installed in ${OUT}.`);
if (missing.length) console.log(`⚠ Missing in the source folder (walkthroughs using them are hidden): ${missing.join(", ")}`);

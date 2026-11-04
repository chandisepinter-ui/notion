/**
 * npm run media:videos -- "<folder>"
 *
 * Installs the Titan how-to training videos listed in the Power Apps Media list.
 * Point it at the synced OneDrive/SharePoint folder that holds them (for example
 * Dispatch Center › How To Videos); subfolders are searched. Copies each listed
 * .mp4 into content-import/media/videos/ (git-ignored, stored only on this computer).
 * Owner decision 2026-11-04: these videos are approved for signed-in Academy users.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const src = process.argv[2];
const OUT = "content-import/media/videos";
const CATALOG = "content-import/generated/titan-catalog.json";
if (!src || !existsSync(src)) {
  console.error('✖ Give the folder that holds the videos:\n  npm run media:videos -- "C:\\...\\How To Videos"');
  process.exit(1);
}
if (!existsSync(CATALOG)) {
  console.error("✖ Run npm run content:import first (the video list comes from the imported Media list).");
  process.exit(1);
}
const wanted = [...new Set(JSON.parse(readFileSync(CATALOG, "utf8")).media.map((m) => m.filename).filter((f) => /\.mp4$/i.test(f)))];
const found = new Map();
(function walk(dir, depth) {
  if (depth > 6) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, depth + 1);
    else {
      const key = e.name.toLowerCase();
      const want = wanted.find((w) => w.toLowerCase() === key);
      if (want && !found.has(want)) found.set(want, p);
    }
  }
})(src, 0);
mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const [name, p] of found) { copyFileSync(p, path.join(OUT, name)); bytes += statSync(p).size; }
console.log(`✔ ${found.size} of ${wanted.length} videos installed in ${OUT} (${(bytes / 1048576).toFixed(0)} MB).`);
const missing = wanted.filter((w) => !found.has(w));
if (missing.length) console.log(`⚠ Not found in that folder (these keep showing "not installed"): ${missing.join(", ")}`);

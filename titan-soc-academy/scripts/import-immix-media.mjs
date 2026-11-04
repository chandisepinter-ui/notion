/**
 * npm run media:import
 *
 * Builds the IMMIX simulator's camera stills from the sanitized IMMIX reference
 * screenshots (SharePoint: SOC Academy Simulation Assets › IMMIX). Copy these
 * files into content-import/reference/immix/ first (names as on SharePoint):
 *   "Event - Notes.png", "Event - Maps.png", "Event - Multiview.png"
 * Output: content-import/media/immix/*.jpg + stills.json  (git-ignored, local only).
 * Owner-authorized Titan imagery — never commit these files.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { Jimp } from "jimp";

const REF = "content-import/reference/immix";
const OUT = "content-import/media/immix";
const pick = (...names) => names.map((n) => `${REF}/${n}`).find(existsSync);

const notes = pick("Event - Notes.png", "event-notes.png");
const maps = pick("Event - Maps.png", "event-maps.png");
const multi = pick("Event - Multiview.png", "multiview.png");
if (!notes || !maps || !multi) {
  console.error(`✖ Missing reference screenshots in ${REF}/. Need "Event - Notes.png", "Event - Maps.png" and "Event - Multiview.png".`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

/** Bounding box of non-black pixels (the camera image inside a letterboxed tile). */
function bbox(img, thr = 18) {
  const { width: w, height: h, data } = img.bitmap;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (l > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function isNight(img) {
  const s = img.clone().resize({ w: 32, h: 32 });
  const d = s.bitmap.data; let sat = 0;
  for (let i = 0; i < d.length; i += 4) sat += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
  return sat / (32 * 32) < 12;
}
const stills = [];
async function save(img, name, scene, extra = {}) {
  await img.write(`${OUT}/${name}.jpg`, { quality: 90 });
  stills.push({ file: `${name}.jpg`, w: img.bitmap.width, h: img.bitmap.height, night: isNight(img), scene, ...extra });
}
async function cropTile(file, x0, y0, x1, y1, cutTop) {
  const img = (await Jimp.read(file)).crop({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  const b = bbox(img);
  if (!b) return null;
  return img.crop(b).crop({ x: 0, y: cutTop, w: b.w, h: b.h - cutTop });
}

// Large live-view frames (burned-in camera text removed; the simulator draws its own).
await save(await cropTile(notes, 1295, 88, 1774, 446, 26), "live-01", "749.1");
await save(await cropTile(maps, 1293, 86, 1772, 444, 26), "live-02", "749.1");
// MultiView tiles.
const cols = [[37, 502], [506, 971], [975, 1439], [1443, 1907]];
const rows = [[178, 337], [397, 556], [616, 774], [835, 993]];
const scenes = ["749.1", "749.2", "749.3", "749.4", "748.1", "748.2", "748.3", "746.1", "746.2", "746.3", "746.4", "747.1", "747.2", "747.3"];
let n = 0;
for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols.length; c++) {
  if (r === 3 && c > 1) continue;
  const t = await cropTile(multi, cols[c][0], rows[r][0], cols[c][1], rows[r][1], 10);
  if (!t) continue;
  n += 1;
  await save(t, `mv-${String(n).padStart(2, "0")}`, scenes[n - 1], scenes[n - 1] === "749.4" ? { roadView: true } : {});
}
writeFileSync(`${OUT}/stills.json`, JSON.stringify({ note: "Real Titan camera stills cropped from sanitized IMMIX reference screenshots. Local only - never commit. Owner-authorized 2026-11-04.", stills }, null, 1));
console.log(`✔ ${stills.length} camera stills written to ${OUT}/ (${stills.filter((s) => s.night).length} night/IR).`);

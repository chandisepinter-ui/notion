import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { getTitanCatalog } from "@/content/titan-catalog";

/**
 * Titan how-to training videos (Power Apps Media list), stored only on this
 * computer in content-import/media/videos (git-ignored).
 *
 * Owner decision (2026-11-04): Titan's own how-to videos are approved for
 * signed-in Academy users. A catalog video plays once its file is installed
 * (npm run media:videos). To withdraw one, delete its file.
 */
export const VIDEO_DIR = path.join(process.cwd(), "content-import", "media", "videos");

/** Only filenames listed in the imported Media catalog are ever served. */
export function catalogVideo(name: string): string | null {
  if (process.env.TITAN_CONTENT === "off") return null;
  const cat = getTitanCatalog();
  const hit = cat?.media.find((m) => m.filename === name && /\.mp4$/i.test(m.filename));
  return hit ? hit.filename : null;
}

export function installedVideos(): Set<string> {
  const cat = getTitanCatalog();
  if (!cat || process.env.TITAN_CONTENT === "off") return new Set();
  return new Set(cat.media.map((m) => m.filename).filter((f) => /\.mp4$/i.test(f) && existsSync(path.join(VIDEO_DIR, f))));
}

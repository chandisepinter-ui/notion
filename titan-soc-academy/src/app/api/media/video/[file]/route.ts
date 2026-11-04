import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getSessionUser } from "@/lib/auth/session";
import { catalogVideo, VIDEO_DIR } from "@/lib/course/videos";

/**
 * Streams an installed Titan training video (signed-in users only, never
 * publicly cached). Supports Range requests so the player can seek.
 */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const name = catalogVideo(decodeURIComponent((await params).file));
  if (!name) return new Response("Not found", { status: 404 });
  const file = path.join(VIDEO_DIR, name);
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    start = Math.max(0, start);
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
}

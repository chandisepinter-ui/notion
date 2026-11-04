import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSessionUser } from "@/lib/auth/session";
import { FRAME_NAME, WALKTHROUGH_DIR } from "@/lib/course/walkthroughs";

/**
 * Serves guided-walkthrough frames from content-import/media/walkthroughs
 * (git-ignored, Titan Academy imagery stored only on this computer).
 * Signed-in users only; never publicly cached.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const file = decodeURIComponent((await params).file);
  if (!FRAME_NAME.test(file)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(WALKTHROUGH_DIR, file));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

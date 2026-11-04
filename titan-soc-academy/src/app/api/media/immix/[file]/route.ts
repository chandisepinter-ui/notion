import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Serves local IMMIX camera stills from content-import/media/immix (git-ignored,
 * owner-authorized Titan imagery). Signed-in users only; never publicly cached.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { file } = await params;
  if (!/^[a-z0-9-]{1,40}\.(jpg|jpeg|png)$/i.test(file)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(process.cwd(), "content-import", "media", "immix", file));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

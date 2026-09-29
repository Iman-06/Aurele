import { readImage } from "@/server/media/storage";

// GET /media/<uuid>.jpg — serves product photos saved by src/server/media/storage.ts.
// File names are random and never reused, so they can be cached forever.
export async function GET(_req: Request, ctx: RouteContext<"/media/[file]">) {
  const { file } = await ctx.params;
  const img = await readImage(file);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.bytes), {
    headers: {
      "content-type": img.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

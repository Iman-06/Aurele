import { existsSync } from "node:fs";
import path from "node:path";

/** Public URL when the file is in /public, otherwise null so the caller can show a dark panel. */
export function publicImage(src: string): string | null {
  const relative = src.replace(/^\//, "");
  return existsSync(path.join(process.cwd(), "public", relative)) ? src : null;
}

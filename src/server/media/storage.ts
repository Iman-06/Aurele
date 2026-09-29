import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "../errors";

// Product photo storage. For now photos are saved on this machine under storage/uploads
// and served by src/app/media/[file]/route.ts. Before launch, swap this file's save/remove
// for Cloudinary (or Supabase Storage) — nothing else needs to change, because the database
// only stores the public URL.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MEDIA_URL_PREFIX = "/media/";
const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
type Ext = keyof typeof TYPES;

const storageDir = () => process.env.MEDIA_DIR ?? path.join(process.cwd(), "storage", "uploads");
const SAFE_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

/** Detect the real file type from its first bytes (never trust the filename or browser). */
export function sniffImageType(bytes: Uint8Array): Ext | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "webp";
  return null;
}

/** Validate and save an uploaded photo. Returns its public URL, e.g. "/media/1f…c2.jpg". */
export async function saveImage(file: File): Promise<string> {
  if (!file || file.size === 0) throw new DomainError("INVALID_INPUT", "Please choose a photo to upload");
  if (file.size > MAX_IMAGE_BYTES) throw new DomainError("INVALID_INPUT", "Photo is too large — maximum 5 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImageType(bytes);
  if (!ext) throw new DomainError("INVALID_INPUT", "Only JPG, PNG or WebP photos can be uploaded");

  const name = `${randomUUID()}.${ext}`;
  await mkdir(storageDir(), { recursive: true });
  await writeFile(path.join(storageDir(), name), bytes);
  return `${MEDIA_URL_PREFIX}${name}`;
}

/** Delete a stored photo by its URL. Unknown/foreign URLs are ignored. */
export async function removeImage(url: string) {
  const name = url.startsWith(MEDIA_URL_PREFIX) ? url.slice(MEDIA_URL_PREFIX.length) : "";
  if (!SAFE_NAME.test(name)) return;
  await unlink(path.join(storageDir(), name)).catch(() => {});
}

/** Read a stored photo for serving. Returns null for anything that isn't one of our file names. */
export async function readImage(name: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const m = SAFE_NAME.exec(name); // also blocks "../" path tricks
  if (!m) return null;
  try {
    return { bytes: await readFile(path.join(storageDir(), name)), contentType: TYPES[m[1] as Ext] };
  } catch {
    return null;
  }
}

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "../errors";

// Product + homepage photo storage. The database only stores each photo's public URL.
//  • Cloudinary (when CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET are set — the live site):
//    photos go to the "aurele/<folder>" folder of the shop's Cloudinary account.
//  • Otherwise (tests, a laptop without the keys): saved under storage/uploads and served by
//    src/app/media/[file]/route.ts. Old "/media/…" URLs keep working either way.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MEDIA_URL_PREFIX = "/media/";
const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
type Ext = keyof typeof TYPES;

const storageDir = () => process.env.MEDIA_DIR ?? path.join(process.cwd(), "storage", "uploads");
// Uploaded photos are runtime data, not build files — the /*turbopackIgnore*/ comments stop the
// production build from bundling the whole project because of these dynamic paths.
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

export type ImageFolder = "products" | "homepage";

/** Validate and save an uploaded photo. Returns its public URL ("https://res.cloudinary.com/…" or "/media/…"). */
export async function saveImage(file: File, folder: ImageFolder = "products"): Promise<string> {
  if (!file || file.size === 0) throw new DomainError("INVALID_INPUT", "Please choose a photo to upload");
  if (file.size > MAX_IMAGE_BYTES) throw new DomainError("INVALID_INPUT", "Photo is too large — maximum 5 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImageType(bytes);
  if (!ext) throw new DomainError("INVALID_INPUT", "Only JPG, PNG or WebP photos can be uploaded");

  const cloud = cloudinaryConfig();
  if (cloud) return uploadToCloudinary(cloud, bytes, ext, folder);

  const name = `${randomUUID()}.${ext}`;
  await mkdir(/*turbopackIgnore: true*/ storageDir(), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ storageDir(), name), bytes);
  return `${MEDIA_URL_PREFIX}${name}`;
}

/** Delete a stored photo by its URL. Unknown/foreign URLs are ignored; failures never block the caller. */
export async function removeImage(url: string) {
  const cloud = cloudinaryConfig();
  const publicId = cloud ? cloudinaryPublicId(url, cloud.cloudName) : null;
  if (cloud && publicId) {
    await destroyOnCloudinary(cloud, publicId).catch((e) => console.error("Cloudinary delete failed", publicId, e));
    return;
  }
  const name = url.startsWith(MEDIA_URL_PREFIX) ? url.slice(MEDIA_URL_PREFIX.length) : "";
  if (!SAFE_NAME.test(name)) return;
  await unlink(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ storageDir(), name)).catch(() => {});
}

/** Read a stored photo for serving. Returns null for anything that isn't one of our file names. */
export async function readImage(name: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const m = SAFE_NAME.exec(name); // also blocks "../" path tricks
  if (!m) return null;
  try {
    return { bytes: await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ storageDir(), name)), contentType: TYPES[m[1] as Ext] };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Cloudinary (signed Upload API calls — no SDK needed)
// ------------------------------------------------------------

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };

export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

const CLOUD_ROOT = "aurele";
// Stored originals are shrunk to at most 2400px and re-encoded, which also strips EXIF/GPS
// location data from phone photos. Delivery adds automatic format + quality (smaller files on phones).
const INCOMING = "c_limit,w_2400,h_2400";
const DELIVERY = "f_auto,q_auto";

/** Cloudinary signature: sha1 of the sorted "key=value&…" params followed by the API secret. */
export function signCloudinary(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

async function cloudinaryCall(cloud: CloudinaryConfig, action: "upload" | "destroy", params: Record<string, string | number>, file?: Blob) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { ...params, timestamp };
  const form = new FormData();
  for (const [k, v] of Object.entries(signed)) form.set(k, String(v));
  form.set("api_key", cloud.apiKey);
  form.set("signature", signCloudinary(signed, cloud.apiSecret));
  if (file) form.set("file", file);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud.cloudName)}/image/${action}`, { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { secure_url?: string; public_id?: string; result?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(`Cloudinary ${action} failed (${res.status}): ${body.error?.message ?? "unknown error"}`);
  return body;
}

async function uploadToCloudinary(cloud: CloudinaryConfig, bytes: Uint8Array, ext: Ext, folder: ImageFolder): Promise<string> {
  let body;
  try {
    body = await cloudinaryCall(
      cloud,
      "upload",
      { folder: `${CLOUD_ROOT}/${folder}`, public_id: randomUUID(), transformation: INCOMING },
      new Blob([new Uint8Array(bytes)], { type: TYPES[ext] }),
    );
  } catch (e) {
    console.error(e);
    throw new DomainError("INVALID_INPUT", "The photo couldn't be uploaded right now. Please try again in a minute.");
  }
  if (!body.secure_url) throw new DomainError("INVALID_INPUT", "The photo couldn't be uploaded right now. Please try again in a minute.");
  return body.secure_url.replace("/image/upload/", `/image/upload/${DELIVERY}/`);
}

async function destroyOnCloudinary(cloud: CloudinaryConfig, publicId: string) {
  const body = await cloudinaryCall(cloud, "destroy", { public_id: publicId, invalidate: "true" });
  if (body.result !== "ok" && body.result !== "not found") throw new Error(`Cloudinary destroy returned ${body.result}`);
}

/**
 * "https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v123/aurele/products/<uuid>.jpg"
 * → "aurele/products/<uuid>". Only photos in OUR account's aurele/ folder — anything else gives null.
 */
export function cloudinaryPublicId(url: string, cloudName: string): string | null {
  const prefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
  if (!url.startsWith(prefix)) return null;
  const parts = url.slice(prefix.length).split("?")[0].split("/");
  const start = parts.indexOf(CLOUD_ROOT);
  if (start === -1) return null;
  const id = parts.slice(start).join("/").replace(/\.[a-z0-9]+$/i, "");
  return /^aurele\/(products|homepage)\/[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

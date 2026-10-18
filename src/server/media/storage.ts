import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "../errors";

// Product photo storage.
// Uploads to Cloudinary (cloud storage) when CLOUDINARY_* environment variables are set.
// Falls back to local disk storage (storage/uploads) in local development if Cloudinary is not configured.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MEDIA_URL_PREFIX = "/media/";
const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
type Ext = keyof typeof TYPES;

const storageDir = () => process.env.MEDIA_DIR ?? path.join(process.cwd(), "storage", "uploads");
const SAFE_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

function getCloudinaryConfig(): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    return { cloudName, apiKey, apiSecret };
  }

  // Also support CLOUDINARY_URL format: cloudinary://<api_key>:<api_secret>@<cloud_name>
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl) {
    const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(cloudinaryUrl);
    if (match) {
      return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
    }
  }

  return null;
}

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

async function uploadToCloudinary(
  bytes: Uint8Array,
  ext: Ext,
  config: { cloudName: string; apiKey: string; apiSecret: string },
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "aurele/products";

  // Cloudinary signature requires parameters sorted alphabetically
  const toSign = `folder=${folder}&timestamp=${timestamp}${config.apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  const formData = new FormData();
  const blob = new Blob([bytes as unknown as BlobPart], { type: TYPES[ext] });
  formData.append("file", blob, `photo.${ext}`);
  formData.append("timestamp", timestamp);
  formData.append("folder", folder);
  formData.append("api_key", config.apiKey);
  formData.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[cloudinary] Upload error:", res.status, errText);
    throw new Error(`Failed to upload image to Cloudinary: ${res.statusText}`);
  }

  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}

async function deleteFromCloudinary(
  url: string,
  config: { cloudName: string; apiKey: string; apiSecret: string },
): Promise<void> {
  // Extract public_id from Cloudinary URL, e.g.
  // https://res.cloudinary.com/{cloud}/image/upload/v12345/aurele/products/xyz123.jpg -> aurele/products/xyz123
  const match = /\/upload\/(?:v\d+\/)?([^.]+)/.exec(url);
  if (!match) return;
  const publicId = match[1];

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${config.apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("timestamp", timestamp);
  formData.append("api_key", config.apiKey);
  formData.append("signature", signature);

  try {
    await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    console.warn("[cloudinary] Delete image failed:", err);
  }
}

/** Validate and save an uploaded photo. Returns its public URL (Cloudinary or local /media/ fallback). */
export async function saveImage(file: File): Promise<string> {
  if (!file || file.size === 0) throw new DomainError("INVALID_INPUT", "Please choose a photo to upload");
  if (file.size > MAX_IMAGE_BYTES) throw new DomainError("INVALID_INPUT", "Photo is too large — maximum 5 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImageType(bytes);
  if (!ext) throw new DomainError("INVALID_INPUT", "Only JPG, PNG or WebP photos can be uploaded");

  const cloudinaryConfig = getCloudinaryConfig();
  if (cloudinaryConfig) {
    return uploadToCloudinary(bytes, ext, cloudinaryConfig);
  }

  // Local filesystem fallback (dev only when Cloudinary env vars are missing)
  console.warn("[media] Cloudinary env vars not found. Saving image locally to storage/uploads.");
  const name = `${randomUUID()}.${ext}`;
  await mkdir(/*turbopackIgnore: true*/ storageDir(), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ storageDir(), name), bytes);
  return `${MEDIA_URL_PREFIX}${name}`;
}

/** Delete a stored photo by its URL. Handles Cloudinary URLs and local files. */
export async function removeImage(url: string) {
  if (!url) return;

  const cloudinaryConfig = getCloudinaryConfig();
  if (cloudinaryConfig && url.includes("res.cloudinary.com")) {
    await deleteFromCloudinary(url, cloudinaryConfig);
    return;
  }

  // Local filesystem fallback deletion
  const name = url.startsWith(MEDIA_URL_PREFIX) ? url.slice(MEDIA_URL_PREFIX.length) : "";
  if (!SAFE_NAME.test(name)) return;
  await unlink(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ storageDir(), name)).catch(() => {});
}

/** Read a stored photo for serving (used by local /media/ route only). */
export async function readImage(name: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const m = SAFE_NAME.exec(name);
  if (!m) return null;
  try {
    return { bytes: await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ storageDir(), name)), contentType: TYPES[m[1] as Ext] };
  } catch {
    return null;
  }
}

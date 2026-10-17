import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/server/errors";
import { cloudinaryPublicId, removeImage, saveImage, signCloudinary } from "@/server/media/storage";

// Cloudinary checks with FAKE keys and a FAKE network — nothing reaches the real account.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const png = () => new File([PNG], "photo.png", { type: "image/png" });

type Call = { url: string; fields: Record<string, string>; file: Blob | null };
let calls: Call[];
let reply: (url: string) => { status: number; body: unknown };

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "demo-shop";
  process.env.CLOUDINARY_API_KEY = "111222333";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  calls = [];
  reply = (url) =>
    url.endsWith("/upload")
      ? { status: 200, body: { secure_url: "https://res.cloudinary.com/demo-shop/image/upload/v1700000000/aurele/products/abc-123.png", public_id: "aurele/products/abc-123" } }
      : { status: 200, body: { result: "ok" } };
  vi.stubGlobal("fetch", async (url: string, init: { body: FormData }) => {
    const fields: Record<string, string> = {};
    let file: Blob | null = null;
    for (const [k, v] of init.body.entries()) {
      if (typeof v === "string") fields[k] = v;
      else file = v;
    }
    calls.push({ url, fields, file });
    const r = reply(url);
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
});

describe("Cloudinary photo storage", () => {
  it("signs requests the way Cloudinary documents it", () => {
    // Example from Cloudinary's "Generating authentication signatures" docs
    expect(signCloudinary({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 }, "abcd")).toBe(
      "bfd09f95f331f558cbd1320e67aa8d488770583e",
    );
  });

  it("uploads to the aurele/<folder> folder, signed, shrunk, and returns a fast delivery URL", async () => {
    const url = await saveImage(png(), "homepage");
    expect(calls).toHaveLength(1);
    const [c] = calls;
    expect(c.url).toBe("https://api.cloudinary.com/v1_1/demo-shop/image/upload");
    expect(c.fields).toMatchObject({ folder: "aurele/homepage", transformation: "c_limit,w_2400,h_2400", api_key: "111222333" });
    expect(c.fields.public_id).toMatch(/^[0-9a-f-]{36}$/);
    const { api_key: _k, signature, ...signed } = c.fields;
    expect(signature).toBe(signCloudinary(signed, "test-secret")); // the secret itself is never sent
    expect(Object.values(c.fields)).not.toContain("test-secret");
    expect(c.file?.type).toBe("image/png");
    expect(url).toBe("https://res.cloudinary.com/demo-shop/image/upload/f_auto,q_auto/v1700000000/aurele/products/abc-123.png");
  });

  it("still refuses non-images and big files before uploading anything", async () => {
    await expect(saveImage(new File([new Uint8Array([1, 2, 3, 4])], "x.png"))).rejects.toBeInstanceOf(DomainError);
    await expect(saveImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png"))).rejects.toThrow(/maximum 5 MB/);
    expect(calls).toHaveLength(0);
  });

  it("a Cloudinary outage gives the owner a friendly message", async () => {
    reply = () => ({ status: 500, body: { error: { message: "Internal error" } } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(saveImage(png())).rejects.toThrow(/couldn't be uploaded right now/);
  });

  it("deletes our own photos from Cloudinary, ignores everything else", async () => {
    await removeImage("https://res.cloudinary.com/demo-shop/image/upload/f_auto,q_auto/v1700000000/aurele/products/abc-123.png");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.cloudinary.com/v1_1/demo-shop/image/destroy");
    expect(calls[0].fields).toMatchObject({ public_id: "aurele/products/abc-123", invalidate: "true" });

    calls = [];
    await removeImage("https://res.cloudinary.com/someone-else/image/upload/v1/aurele/products/abc.png"); // another account
    await removeImage("https://res.cloudinary.com/demo-shop/image/upload/v1/other-folder/abc.png"); // not our folder
    await removeImage("https://example.com/aurele/products/abc.png");
    expect(calls).toHaveLength(0);
  });

  it("a failed delete never breaks deleting the product/photo in the admin", async () => {
    reply = () => ({ status: 500, body: { error: { message: "down" } } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(removeImage("https://res.cloudinary.com/demo-shop/image/upload/v1/aurele/homepage/x1.jpg")).resolves.toBeUndefined();
  });

  it("works out the public id from delivery URLs with or without transformations", () => {
    const id = (u: string) => cloudinaryPublicId(u, "demo-shop");
    expect(id("https://res.cloudinary.com/demo-shop/image/upload/v17/aurele/products/a-b_c.jpg")).toBe("aurele/products/a-b_c");
    expect(id("https://res.cloudinary.com/demo-shop/image/upload/f_auto,q_auto/v17/aurele/homepage/xyz.webp")).toBe("aurele/homepage/xyz");
    expect(id("https://res.cloudinary.com/demo-shop/image/upload/v17/aurele/../../evil.jpg")).toBeNull();
    expect(id("/media/1f3c.jpg")).toBeNull();
  });

  it("without the keys, photos are saved locally as before", async () => {
    delete process.env.CLOUDINARY_API_SECRET;
    process.env.MEDIA_DIR = (await import("node:os")).tmpdir() + "/aurele-media-test";
    const url = await saveImage(png());
    expect(url).toMatch(/^\/media\/[0-9a-f-]{36}\.png$/);
    expect(calls).toHaveLength(0);
    await removeImage(url);
    delete process.env.MEDIA_DIR;
  });
});

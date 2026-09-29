import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addImage,
  addVariant,
  createProduct,
  deleteImage,
  deleteProduct,
  deleteVariant,
  getAdminProduct,
  listAdminProducts,
  moveImage,
  nextArticleNo,
  setFinishPrice,
  setProductFlags,
  updateProduct,
  updateVariant,
} from "@/server/admin/products";
import { getProductDetail } from "@/server/catalog/catalog";
import { DomainError } from "@/server/errors";
import { readImage, sniffImageType } from "@/server/media/storage";
import { placeOrder } from "@/server/orders/orders";
import { ensureDefaultSettings } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";

// Tiny valid image headers (enough for type detection)
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
const file = (bytes: Uint8Array, name = "photo.png") => new File([Buffer.from(bytes)], name);

let mediaDir: string;
beforeAll(async () => {
  mediaDir = await mkdtemp(path.join(os.tmpdir(), "lunara-media-"));
  process.env.MEDIA_DIR = mediaDir;
});
afterAll(async () => {
  await rm(mediaDir, { recursive: true, force: true });
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  await ensureDefaultSettings(db);
});

async function expectError(p: Promise<unknown>, code: string, message?: RegExp) {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (message) expect((e as DomainError).message).toMatch(message);
}

const customer = { name: "Test Buyer", email: "b@example.com", phone: "03001234567", address: "1 Test Street", city: "Karachi" };

describe("designs", () => {
  it("creates with the next free article number per category, capitalised name and slug", async () => {
    const a = await createProduct(db, { category: "EARRINGS", name: "aveline pearl drop", isActive: "on" });
    const b = await createProduct(db, { category: "EARRINGS", name: "Celine" });
    const r = await createProduct(db, { category: "RINGS", name: "Caroline" });
    expect([a.articleNo, b.articleNo, r.articleNo]).toEqual([1, 2, 1]);
    expect(a).toMatchObject({ name: "Aveline Pearl Drop", slug: "aveline-pearl-drop-ear-001", isActive: true, isNewArrival: false });
    expect(await nextArticleNo(db, "EARRINGS")).toBe(3);
  });

  it("refuses a taken article number, and bad input", async () => {
    await createProduct(db, { category: "EARRINGS", name: "Aveline", articleNo: "5" });
    await expectError(createProduct(db, { category: "EARRINGS", name: "Other", articleNo: "5" }), "INVALID_INPUT", /005 is already used by "Aveline"/);
    await expectError(createProduct(db, { category: "EARRINGS", name: "" }), "INVALID_INPUT");
    await expectError(createProduct(db, { category: "SHOES" as never, name: "X" }), "INVALID_INPUT");
  });

  it("edits name/description/flags but keeps the URL", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline", isActive: "on" });
    const u = await updateProduct(db, p.id, { name: "aveline drop", description: "Pearl", isActive: "", isNewArrival: "on" });
    expect(u).toMatchObject({ name: "Aveline Drop", description: "Pearl", isActive: false, isNewArrival: true, slug: p.slug });
    expect((await setProductFlags(db, p.id, { isActive: true })).isActive).toBe(true);
    await expectError(updateProduct(db, 999, { name: "X Y" }), "NOT_FOUND");
  });

  it("lists with stock totals, unpriced counts and filters", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline", isActive: "on" });
    await addVariant(db, p.id, { finish: "GOLD", colour: "Blue", quantity: "2" });
    await addVariant(db, p.id, { finish: "GOLD", colour: "Green", quantity: "3", sellingPrice: "2,800" });
    const hidden = await createProduct(db, { category: "RINGS", name: "Caroline" });

    const [row] = await listAdminProducts(db, { q: "avel" });
    expect(row).toMatchObject({ name: "Aveline", variantCount: 2, totalStock: 5, unpricedCount: 1, imageCount: 0 });
    expect((await listAdminProducts(db, { status: "hidden" })).map((r) => r.id)).toEqual([hidden.id]);
    expect((await listAdminProducts(db, { status: "unpriced" })).map((r) => r.id)).toEqual([p.id]);
    expect((await listAdminProducts(db, { category: "RINGS" })).map((r) => r.id)).toEqual([hidden.id]);
    expect((await listAdminProducts(db, { q: "EAR-001" })).map((r) => r.id)).toEqual([p.id]); // by SKU
  });

  it("can only delete a design that was never sold", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline", isActive: "on" });
    const v = await addVariant(db, p.id, { finish: "GOLD", quantity: "3", sellingPrice: "2500" });
    await placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer, paymentMethod: "COD" });
    await expectError(deleteProduct(db, p.id), "INVALID_TRANSITION", /Hide it instead/);

    const q = await createProduct(db, { category: "EARRINGS", name: "Unsold" });
    await addVariant(db, q.id, { finish: "GOLD", quantity: "3" });
    await deleteProduct(db, q.id);
    expect(await db.product.findUnique({ where: { id: q.id } })).toBeNull();
  });
});

describe("stock rows", () => {
  it("adds rows with generated SKU and logs the starting stock", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline" });
    const v = await addVariant(db, p.id, { finish: "SILVER", colour: "royal blue", quantity: "4", sellingPrice: "Rs 2,500", costPrice: "1200" });
    expect(v).toMatchObject({ sku: "EAR-001-SL", colour: "Royal Blue", size: "", quantity: 4 });
    expect([Number(v.sellingPrice), Number(v.costPrice)]).toEqual([2500, 1200]);
    const m = await db.stockMovement.findFirstOrThrow({ where: { variantId: v.id } });
    expect(m).toMatchObject({ change: 4, quantityAfter: 4, reason: "ADMIN_ADJUST" });

    const none = await addVariant(db, p.id, { finish: "GOLD", colour: "", quantity: "" });
    expect(none).toMatchObject({ colour: "None / Single", quantity: 0 });
  });

  it("a new colour inherits its finish's price (same price per finish)", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline" });
    await addVariant(db, p.id, { finish: "GOLD", colour: "Blue", quantity: "1", sellingPrice: "2800", costPrice: "1000" });
    const green = await addVariant(db, p.id, { finish: "GOLD", colour: "Green", quantity: "1" });
    const silver = await addVariant(db, p.id, { finish: "SILVER", colour: "Green", quantity: "1" });
    expect([Number(green.sellingPrice), Number(green.costPrice)]).toEqual([2800, 1000]);
    expect(silver.sellingPrice).toBeNull();
  });

  it("rings need a size from the list; other categories ignore size", async () => {
    const ring = await createProduct(db, { category: "RINGS", name: "Caroline" });
    await expectError(addVariant(db, ring.id, { finish: "GOLD", quantity: "1" }), "INVALID_INPUT", /ring size/);
    await expectError(addVariant(db, ring.id, { finish: "GOLD", size: "15", quantity: "1" }), "INVALID_INPUT");
    expect((await addVariant(db, ring.id, { finish: "GOLD", size: "8.0", quantity: "1" })).size).toBe("8");
    expect((await addVariant(db, ring.id, { finish: "GOLD", size: "adjustable", quantity: "1" })).size).toBe("Adjustable");

    const ear = await createProduct(db, { category: "EARRINGS", name: "Stud" });
    expect((await addVariant(db, ear.id, { finish: "GOLD", size: "8", quantity: "1" })).size).toBe("");
  });

  it("rejects duplicates, unknown colours and bad numbers", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline" });
    await addVariant(db, p.id, { finish: "GOLD", colour: "Blue", quantity: "1" });
    await expectError(addVariant(db, p.id, { finish: "GOLD", colour: "blue", quantity: "1" }), "INVALID_INPUT", /already exists/);
    await expectError(addVariant(db, p.id, { finish: "GOLD", colour: "Sparkly", quantity: "1" }), "INVALID_INPUT", /colour list/);
    await expectError(addVariant(db, p.id, { finish: "GOLD", colour: "Red", quantity: "-1" }), "INVALID_INPUT");
    await expectError(addVariant(db, p.id, { finish: "GOLD", colour: "Red", quantity: "1.5" }), "INVALID_INPUT");
    await expectError(addVariant(db, p.id, { finish: "GOLD", colour: "Red", quantity: "1", sellingPrice: "abc" }), "INVALID_INPUT");
    await expectError(addVariant(db, p.id, { finish: "GOLD", colour: "Red", quantity: "1", sellingPrice: "-5" }), "INVALID_INPUT");
    await expectError(addVariant(db, 999, { finish: "GOLD", quantity: "1" }), "NOT_FOUND");
  });

  it("updates prices and the hidden/sold-out switch", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline" });
    const v = await addVariant(db, p.id, { finish: "GOLD", quantity: "1" });
    const u = await updateVariant(db, v.id, { sellingPrice: "3,100", costPrice: "", isActive: "" });
    expect([Number(u.sellingPrice), u.costPrice, u.isActive]).toEqual([3100, null, false]);
  });

  it("finish pricing sets every colour/size of that finish at once — and makes it visible", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline", isActive: "on" });
    for (const colour of ["Blue", "Green", "Red"]) await addVariant(db, p.id, { finish: "GOLD", colour, quantity: "2" });
    await addVariant(db, p.id, { finish: "SILVER", colour: "Blue", quantity: "2" });
    expect(await getProductDetail(db, p.slug)).toBeNull(); // nothing priced yet → not on the site

    expect(await setFinishPrice(db, p.id, { finish: "GOLD", sellingPrice: "2,800", costPrice: "1,100" })).toBe(3);
    const rows = await db.variant.findMany({ where: { productId: p.id }, orderBy: { id: "asc" } });
    expect(rows.map((r) => (r.sellingPrice === null ? null : Number(r.sellingPrice)))).toEqual([2800, 2800, 2800, null]);

    const d = (await getProductDetail(db, p.slug))!;
    expect(d.finishes.map((f) => f.finish)).toEqual(["GOLD"]); // Silver still unpriced → not offered
    await expectError(setFinishPrice(db, p.id, { finish: "GOLD", sellingPrice: "" }), "INVALID_INPUT");
  });

  it("can only delete a row that was never sold", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline", isActive: "on" });
    const sold = await addVariant(db, p.id, { finish: "GOLD", colour: "Blue", quantity: "3", sellingPrice: "2500" });
    const unsold = await addVariant(db, p.id, { finish: "GOLD", colour: "Green", quantity: "3" });
    await placeOrder(db, { items: [{ variantId: sold.id, quantity: 1 }], customer, paymentMethod: "COD" });
    await expectError(deleteVariant(db, sold.id), "INVALID_TRANSITION", /Mark it hidden/);
    await deleteVariant(db, unsold.id);
    expect((await getAdminProduct(db, p.id))!.variants.map((v) => v.id)).toEqual([sold.id]);
  });
});

describe("photos", () => {
  it("detects the real file type from its bytes", () => {
    expect(sniffImageType(PNG)).toBe("png");
    expect(sniffImageType(JPG)).toBe("jpg");
    expect(sniffImageType(WEBP)).toBe("webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("uploads, tags by finish+colour, reorders and deletes (file removed too)", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline" });
    const a = await addImage(db, p.id, file(PNG), { finish: "GOLD", colour: "Blue" });
    const b = await addImage(db, p.id, file(JPG, "b.jpg"), { finish: "", colour: "" });
    expect(a).toMatchObject({ finish: "GOLD", colour: "Blue", sortOrder: 0 });
    expect(b).toMatchObject({ finish: null, colour: null, sortOrder: 1 });
    expect(a.url).toMatch(/^\/media\/[a-f0-9-]{36}\.png$/);
    expect((await readImage(a.url.replace("/media/", "")))?.contentType).toBe("image/png");

    await moveImage(db, b.id, "up");
    expect((await getAdminProduct(db, p.id))!.images.map((i) => i.id)).toEqual([b.id, a.id]);
    await moveImage(db, b.id, "up"); // already first → no change
    expect((await getAdminProduct(db, p.id))!.images.map((i) => i.id)).toEqual([b.id, a.id]);

    await deleteImage(db, a.id);
    expect(await readdir(mediaDir)).toHaveLength(1);
  });

  it("rejects non-images, oversized files, and colour without finish", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Aveline" });
    await expectError(addImage(db, p.id, file(new TextEncoder().encode("<html>"), "x.png"), {}), "INVALID_INPUT", /JPG, PNG or WebP/);
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG);
    await expectError(addImage(db, p.id, file(big), {}), "INVALID_INPUT", /maximum 5 MB/);
    await expectError(addImage(db, p.id, file(PNG), { colour: "Blue" }), "INVALID_INPUT", /Choose a finish/);
    await expectError(addImage(db, p.id, file(new Uint8Array()), {}), "INVALID_INPUT", /choose a photo/);
    expect(await db.productImage.count()).toBe(0);
  });

  it("the media route refuses path tricks", async () => {
    expect(await readImage("../../.env")).toBeNull();
    expect(await readImage("..%2F..%2F.env")).toBeNull();
    expect(await readImage("00000000-0000-0000-0000-000000000000.png")).toBeNull(); // valid name, no file
  });

  it("deleting a design removes its photo files", async () => {
    const p = await createProduct(db, { category: "EARRINGS", name: "Temp" });
    await addImage(db, p.id, file(PNG), {});
    const before = (await readdir(mediaDir)).length;
    await deleteProduct(db, p.id);
    expect((await readdir(mediaDir)).length).toBe(before - 1);
  });
});

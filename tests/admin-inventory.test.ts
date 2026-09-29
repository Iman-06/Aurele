import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runStagedImport, stageImport } from "@/server/admin/excel-import";
import { getStockHistory, listInventory, receiveStock, updateSettings } from "@/server/admin/inventory";
import { setFinishPrice } from "@/server/admin/products";
import { DomainError } from "@/server/errors";
import { buildInventoryWorkbook, inventoryWorkbookBuffer } from "@/server/inventory/exporter";
import { applyImport, loadWorkbook, parseWorkbook } from "@/server/inventory/importer";
import { cancelOrder, placeOrder } from "@/server/orders/orders";
import { ensureDefaultSettings, getNumberSetting } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";
import { createDesign } from "./helpers/fixtures";

const REAL_FILE = path.join(process.cwd(), "data", "Lunara_Inventory_System_FINAL.xlsx");
const customer = { name: "Test Buyer", email: "b@example.com", phone: "03001234567", address: "1 Test Street", city: "Karachi" };

let importDir: string;
beforeAll(async () => {
  importDir = await mkdtemp(path.join(os.tmpdir(), "lunara-imports-"));
  process.env.IMPORT_DIR = importDir;
});
afterAll(async () => {
  await rm(importDir, { recursive: true, force: true });
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

async function importRealWorkbook() {
  await applyImport(db, parseWorkbook(await loadWorkbook(REAL_FILE)));
}

describe("inventory table", () => {
  beforeEach(async () => {
    await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", colour: "Blue", qty: 0 }, { finish: "GOLD", colour: "Green", qty: 2 }, { finish: "SILVER", colour: "Blue", qty: 9, price: null }] });
    await createDesign({ name: "Caroline", category: "RINGS", variants: [{ finish: "GOLD", size: "8", qty: 3, active: false }] });
    await createDesign({ name: "Hidden Design", active: false, variants: [{ finish: "SILVER", qty: 5 }] });
  });
  const labels = async (f: Parameters<typeof listInventory>[1]) =>
    (await listInventory(db, f)).rows.map((r) => `${r.productName} ${r.finish} ${r.colour} ${r.size}`.trim());

  it("lists every stock row with its stock status and totals", async () => {
    const { rows, totals } = await listInventory(db);
    expect(rows).toHaveLength(5);
    expect(totals).toMatchObject({ rows: 5, pieces: 19, outOfStock: 1, lowStock: 2 });
    expect(rows.find((r) => r.colour === "Green")!.stock).toEqual({ status: "LOW_STOCK", left: 2 });
  });

  it("filters: out of stock, low stock, hidden, unpriced, category, search", async () => {
    expect(await labels({ status: "out" })).toEqual(["Aveline GOLD Blue"]);
    expect(await labels({ status: "low" })).toEqual(["Aveline GOLD Green", "Caroline GOLD None / Single 8"]);
    // hidden row (Caroline) + every row of a hidden design; listed by category (Earrings first)
    expect(await labels({ status: "hidden" })).toEqual(["Hidden Design SILVER None / Single", "Caroline GOLD None / Single 8"]);
    expect(await labels({ status: "unpriced" })).toEqual(["Aveline SILVER Blue"]);
    expect(await labels({ category: "RINGS" })).toEqual(["Caroline GOLD None / Single 8"]);
    expect(await labels({ q: "green" })).toEqual(["Aveline GOLD Green"]);
    expect(await labels({ q: "RNG-" })).toEqual(["Caroline GOLD None / Single 8"]);
  });

  it("uses the owner's low-stock limit", async () => {
    await updateSettings(db, { shipping_fee: "250", low_stock_threshold: "1" });
    expect(await labels({ status: "low" })).toEqual([]);
  });
});

describe("receiving stock", () => {
  it("adds on top of the current quantity and logs it", async () => {
    const p = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", qty: 2 }] });
    expect(await receiveStock(db, { variantId: p.variants[0].id, add: "5", note: "Delivery from Karachi" })).toBe(7);
    const m = await db.stockMovement.findFirstOrThrow({ where: { variantId: p.variants[0].id } });
    expect(m).toMatchObject({ change: 5, quantityAfter: 7, reason: "ADMIN_ADJUST", note: "Delivery from Karachi" });
  });

  it("never loses a sale that happens at the same moment", async () => {
    const p = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", qty: 1 }] });
    const id = p.variants[0].id;
    await Promise.all([
      receiveStock(db, { variantId: id, add: 10 }),
      placeOrder(db, { items: [{ variantId: id, quantity: 1 }], customer, paymentMethod: "COD" }),
    ]);
    expect((await db.variant.findUniqueOrThrow({ where: { id } })).quantity).toBe(10); // 1 + 10 − 1
  });

  it("rejects zero, negative, fractional and unknown rows", async () => {
    const p = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", qty: 2 }] });
    for (const add of ["0", "-3", "1.5", "abc", ""]) {
      await expectError(receiveStock(db, { variantId: p.variants[0].id, add }), "INVALID_INPUT");
    }
    await expectError(receiveStock(db, { variantId: 999999, add: "1" }), "NOT_FOUND");
  });
});

describe("stock history", () => {
  it("shows every change newest first, with order numbers for sales and cancellations", async () => {
    const p = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", qty: 5 }] });
    const id = p.variants[0].id;
    await receiveStock(db, { variantId: id, add: 3 });
    const order = await placeOrder(db, { items: [{ variantId: id, quantity: 2 }], customer, paymentMethod: "COD" });
    await cancelOrder(db, { orderId: order.id, reason: "Customer changed mind" });

    const h = (await getStockHistory(db, id))!;
    expect(h.variant.product.name).toBe("Aveline");
    expect(h.movements.map((m) => [m.reason, m.change, m.quantityAfter, m.order?.orderNumber ?? null])).toEqual([
      ["ORDER_CANCELLED", 2, 8, order.orderNumber],
      ["SALE", -2, 6, order.orderNumber],
      ["ADMIN_ADJUST", 3, 8, null],
    ]);
    expect(await getStockHistory(db, 999999)).toBeNull();
  });
});

describe("settings", () => {
  it("saves shipping fee and low-stock limit; rejects bad values", async () => {
    await updateSettings(db, { shipping_fee: "Rs 300", low_stock_threshold: "5" });
    expect([await getNumberSetting(db, "shipping_fee"), await getNumberSetting(db, "low_stock_threshold")]).toEqual([300, 5]);
    await expectError(updateSettings(db, { shipping_fee: "-1", low_stock_threshold: "3" }), "INVALID_INPUT");
    await expectError(updateSettings(db, { shipping_fee: "250", low_stock_threshold: "2.5" }), "INVALID_INPUT");
    await expectError(updateSettings(db, { shipping_fee: "free", low_stock_threshold: "3" }), "INVALID_INPUT");
    expect(await getNumberSetting(db, "shipping_fee")).toBe(300); // unchanged after failures
  });
});

describe("Excel export", () => {
  it("uses the workbook's own tabs and columns", async () => {
    await importRealWorkbook();
    const wb = await buildInventoryWorkbook(db);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Earrings", "Rings", "Bracelets", "Necklace"]);
    const header = (name: string) => (wb.getWorksheet(name)!.getRow(1).values as unknown[]).slice(1);
    expect(header("Earrings")).toEqual(["SKU", "Article No.", "Product Name", "Finish", "Colour", "Quantity", "Cost Price", "Selling Price", "Status", "Photo Ref."]);
    expect(header("Rings")).toEqual(["SKU", "Article No.", "Product Name", "Finish", "Colour", "Size", "Quantity", "Cost Price", "Selling Price", "Status", "Photo Ref."]);
    const first = (wb.getWorksheet("Earrings")!.getRow(2).values as unknown[]).slice(1);
    expect(first.slice(0, 9)).toEqual(["EAR-001-GD", 1, "Aveline Pearl Drop", "Gold", "Blue", 2, 2500, undefined, "Low Stock"]); // blank selling price
    expect(wb.getWorksheet("Earrings")!.rowCount).toBe(16); // header + 15 rows
    expect(wb.getWorksheet("Bracelets")!.rowCount).toBe(1);
  });

  it("round trip: exporting and re-importing changes nothing", async () => {
    await importRealWorkbook();
    const p = await db.product.findFirstOrThrow({ where: { name: "Aveline Pearl Drop" } });
    await setFinishPrice(db, p.id, { finish: "GOLD", sellingPrice: "2800" }); // include some admin edits
    const before = await db.variant.findMany({ orderBy: { id: "asc" } });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await inventoryWorkbookBuffer(db)) as unknown as ArrayBuffer);
    const parsed = parseWorkbook(wb);
    expect(parsed.issues).toEqual([]);
    const report = await applyImport(db, parsed);
    expect(report).toMatchObject({ productsCreated: 0, productsUpdated: 0, variantsCreated: 0, variantsUpdated: 0, variantsUnchanged: 22 });

    const after = await db.variant.findMany({ orderBy: { id: "asc" } });
    expect(after.map((v) => [v.quantity, v.sellingPrice?.toString() ?? null, v.sku])).toEqual(
      before.map((v) => [v.quantity, v.sellingPrice?.toString() ?? null, v.sku]),
    );
  });
});

describe("Excel import from the admin panel", () => {
  const upload = async (bytes: Uint8Array, name = "inventory.xlsx") => new File([Buffer.from(bytes)], name);

  it("preview saves nothing; apply saves; the upload can't be reused", async () => {
    const token = await stageImport(await upload(await readFile(REAL_FILE)));
    const preview = await runStagedImport(db, token, { apply: false });
    expect(preview).toMatchObject({ dryRun: true, productsCreated: 9, variantsCreated: 22 });
    expect(await db.variant.count()).toBe(0);

    const applied = await runStagedImport(db, token, { apply: true });
    expect(applied).toMatchObject({ dryRun: false, variantsCreated: 22 });
    expect(await db.variant.count()).toBe(22);
    await expectError(runStagedImport(db, token, { apply: true }), "INVALID_INPUT", /expired/);
  });

  it("keeps the stock protection once orders exist", async () => {
    await importRealWorkbook();
    const v = await db.variant.findFirstOrThrow({ where: { sku: "EAR-001-GD", colour: "Blue" } });
    await db.variant.update({ where: { id: v.id }, data: { sellingPrice: 2500 } });
    await placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer, paymentMethod: "COD" });

    const token = await stageImport(await upload(await readFile(REAL_FILE)));
    const r = await runStagedImport(db, token, { apply: true });
    expect(r.stockProtected).toBe(true);
    expect((await db.variant.findUniqueOrThrow({ where: { id: v.id } })).quantity).toBe(1); // sale kept
  });

  it("rejects non-Excel files, broken files, empty uploads and expired or fake tokens", async () => {
    await expectError(stageImport(await upload(new TextEncoder().encode("a,b,c"), "x.csv")), "INVALID_INPUT", /\.xlsx/);
    await expectError(stageImport(await upload(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))), "INVALID_INPUT", /couldn't be read/);
    await expectError(stageImport(await upload(new Uint8Array())), "INVALID_INPUT");
    await expectError(runStagedImport(db, "../../.env", { apply: false }), "INVALID_INPUT", /expired/);

    const token = await stageImport(await upload(await readFile(REAL_FILE)));
    const threeHoursLater = new Date(Date.now() + 3 * 3600_000);
    await expectError(runStagedImport(db, token, { apply: true }, threeHoursLater), "INVALID_INPUT", /expired/);
    expect(await db.variant.count()).toBe(0);
  });
});

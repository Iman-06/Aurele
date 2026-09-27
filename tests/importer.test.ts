import path from "node:path";
import ExcelJS from "exceljs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { applyImport, loadWorkbook, parseWorkbook } from "@/server/inventory/importer";
import { resetDb, testDb as db } from "./helpers/db";

// ---- helpers ------------------------------------------------------------

const STD_HEADERS = ["SKU", "Article No.", "Product Name", "Finish", "Colour", "Quantity", "Cost Price", "Selling Price", "Status", "Photo Ref."];
const RING_HEADERS = ["SKU", "Article No.", "Product Name", "Finish", "Colour", "Size", "Quantity", "Cost Price", "Selling Price", "Status", "Photo Ref."];

type Row = (string | number | null)[];

/** Build an in-memory workbook shaped like the real one. Rows omit the SKU column (it's a formula). */
function workbook(sheets: Partial<Record<"Earrings" | "Rings" | "Bracelets" | "Necklace", Row[]>>) {
  const wb = new ExcelJS.Workbook();
  for (const name of ["Earrings", "Rings", "Bracelets", "Necklace"] as const) {
    const ws = wb.addWorksheet(name);
    ws.addRow(name === "Rings" ? RING_HEADERS : STD_HEADERS);
    for (const r of sheets[name] ?? []) ws.addRow([null, ...r]);
  }
  return wb;
}

// Earrings row: article, name, finish, colour, qty, cost, selling, status, photo
const ear = (a: number, n: string, f: string, c: string | null, q: number | string | null, cost: number | null = 2500, sell: number | null = null, photo: string | null = null): Row =>
  [a, n, f, c, q, cost, sell, null, photo];
// Rings row: article, name, finish, colour, size, qty, cost, selling
const ring = (a: number, n: string, f: string, c: string, s: string | number | null, q: number): Row =>
  [a, n, f, c, s, q, 1000, null, null, null];

async function importWb(wb: ExcelJS.Workbook, opts = {}) {
  return applyImport(db, parseWorkbook(wb), opts);
}

const REAL_FILE = path.join(process.cwd(), "data", "Lunara_Inventory_System_FINAL.xlsx");

beforeEach(resetDb);
afterAll(() => db.$disconnect());

// ---- parsing ------------------------------------------------------------

describe("parseWorkbook", () => {
  it("groups colour rows under one design and generates SKUs", () => {
    const { variants, issues } = parseWorkbook(
      workbook({ Earrings: [ear(1, "Aveline pearl drop ", "Gold", "Blue", 2), ear(1, "Aveline pearl drop", "Gold", "Green", 3), ear(1, "Aveline pearl drop", "Silver", "Blue", 1)] }),
    );
    expect(issues).toEqual([]);
    expect(variants.map((v) => [v.sku, v.colour, v.quantity, v.name])).toEqual([
      ["EAR-001-GD", "Blue", 2, "Aveline Pearl Drop"],
      ["EAR-001-GD", "Green", 3, "Aveline Pearl Drop"],
      ["EAR-001-SL", "Blue", 1, "Aveline Pearl Drop"],
    ]);
  });

  it("skips blank rows and reports bad rows with their sheet + row number", () => {
    const { variants, issues } = parseWorkbook(
      workbook({
        Earrings: [
          ear(1, "Good", "Gold", "Blue", 1),
          [null, null, null, null, null, null, null, null, null], // blank
          ear(2, "No finish", "", "Blue", 1),
          ear(3, "Bad colour", "Gold", "Sparkly", 1),
          ear(4, "Negative", "Gold", "Blue", -2),
          ear(5, "Fraction", "Gold", "Blue", 1.5),
          [null, "No article", "Gold", "Blue", 1, null, null, null, null],
          ear(6, "Bad price", "Gold", "Blue", 1, null, -100),
        ],
      }),
    );
    expect(variants.map((v) => v.name)).toEqual(["Good"]);
    const errs = issues.filter((i) => i.level === "error").map((i) => `${i.where}: ${i.message}`);
    expect(errs).toHaveLength(6);
    expect(errs[0]).toMatch(/^Earrings!4: Finish must be Gold or Silver/);
    expect(errs[1]).toMatch(/^Earrings!5: Colour "Sparkly" is not in the colour list/);
    expect(errs[2]).toMatch(/^Earrings!6: Quantity must be a whole number/);
    expect(errs[3]).toMatch(/^Earrings!7: Quantity must be a whole number/);
    expect(errs[4]).toMatch(/^Earrings!8: Article No\. missing/);
    expect(errs[5]).toMatch(/^Earrings!9: Selling Price must be a number/);
  });

  it("treats blank colour as None / Single and blank quantity as 0 (with a warning)", () => {
    const { variants, issues } = parseWorkbook(workbook({ Earrings: [ear(1, "Stud", "Gold", null, null)] }));
    expect(variants[0]).toMatchObject({ colour: "None / Single", quantity: 0 });
    expect(issues).toContainEqual(expect.objectContaining({ level: "warning", message: expect.stringMatching(/Quantity blank/) }));
  });

  it("treats a selling price of 0 as not priced (never free)", () => {
    const { variants, issues } = parseWorkbook(workbook({ Earrings: [ear(1, "Stud", "Gold", "Blue", 1, 0, 0)] }));
    expect(variants[0].sellingPrice).toBeNull();
    expect(variants[0].costPrice).toBeNull();
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringMatching(/Selling Price is 0/) }));
  });

  it("merges exact duplicate rows and sums the quantity", () => {
    const { variants, issues } = parseWorkbook(
      workbook({ Rings: [ring(2, "Caroline", "Gold", "None / Single", 8, 1), ring(2, "Caroline", "Gold", "None / Single", "8.0", 1)] }),
    );
    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({ size: "8", quantity: 2, sourceRows: ["Rings!2", "Rings!3"] });
    expect(issues[0].message).toMatch(/Duplicate of Rings!2.*quantity now 2/);
  });

  it("keeps ring sizes separate and requires a size for rings", () => {
    const { variants, issues } = parseWorkbook(
      workbook({ Rings: [ring(1, "Band", "Gold", "Blue", 7, 1), ring(1, "Band", "Gold", "Blue", 8, 1), ring(1, "Band", "Gold", "Blue", null, 1)] }),
    );
    expect(variants.map((v) => v.size)).toEqual(["7", "8"]);
    expect(issues).toContainEqual(expect.objectContaining({ where: "Rings!4", message: expect.stringMatching(/Ring Size missing/) }));
  });

  it("warns when the same article has two different names and keeps the first", () => {
    const { variants, issues } = parseWorkbook(
      workbook({ Earrings: [ear(1, "Aveline", "Gold", "Blue", 1), ear(1, "Something Else", "Silver", "Blue", 1)] }),
    );
    expect(variants.every((v) => v.name === "Aveline")).toBe(true);
    expect(issues[0].message).toMatch(/differs from "Aveline"/);
  });

  it("the same article number in different categories is a different design", () => {
    const { variants } = parseWorkbook(
      workbook({ Earrings: [ear(1, "Ear One", "Gold", "Blue", 1)], Rings: [ring(1, "Ring One", "Gold", "Blue", 7, 1)] }),
    );
    expect(variants.map((v) => v.sku)).toEqual(["EAR-001-GD", "RNG-001-GD"]);
  });
});

// ---- database write -----------------------------------------------------

describe("applyImport", () => {
  const basic = () =>
    workbook({
      Earrings: [ear(1, "Aveline pearl drop", "Gold", "Blue", 2), ear(1, "Aveline pearl drop", "Gold", "Green", 3)],
      Rings: [ring(2, "Caroline", "Gold", "None / Single", 8, 1)],
    });

  it("creates designs, stock rows, slugs and an IMPORT stock history entry", async () => {
    const r = await importWb(basic());
    expect(r).toMatchObject({ productsCreated: 2, variantsCreated: 3, variantsUpdated: 0 });

    const p = await db.product.findFirstOrThrow({ where: { category: "EARRINGS", articleNo: 1 }, include: { variants: true } });
    expect(p.name).toBe("Aveline Pearl Drop");
    expect(p.slug).toBe("aveline-pearl-drop-ear-001");
    expect(p.variants).toHaveLength(2);

    const moves = await db.stockMovement.findMany({ orderBy: { id: "asc" } });
    expect(moves.map((m) => [m.change, m.quantityAfter, m.reason])).toEqual([
      [2, 2, "IMPORT"],
      [3, 3, "IMPORT"],
      [1, 1, "IMPORT"],
    ]);
  });

  it("is safe to run twice — nothing duplicated, nothing changed", async () => {
    await importWb(basic());
    const r2 = await importWb(basic());
    expect(r2).toMatchObject({ productsCreated: 0, variantsCreated: 0, variantsUpdated: 0, variantsUnchanged: 3 });
    expect(await db.product.count()).toBe(2);
    expect(await db.variant.count()).toBe(3);
    expect(await db.stockMovement.count()).toBe(3);
  });

  it("updates quantities that changed in the sheet and logs the difference", async () => {
    await importWb(basic());
    const r = await importWb(
      workbook({
        Earrings: [ear(1, "Aveline pearl drop", "Gold", "Blue", 5), ear(1, "Aveline pearl drop", "Gold", "Green", 3)],
        Rings: [ring(2, "Caroline", "Gold", "None / Single", 8, 1)],
      }),
    );
    expect(r.variantsUpdated).toBe(1);
    expect(r.stockChanges).toEqual([{ sku: "EAR-001-GD", label: "Aveline Pearl Drop / Gold / Blue", from: 2, to: 5 }]);
    const last = await db.stockMovement.findFirstOrThrow({ orderBy: { id: "desc" } });
    expect([last.change, last.quantityAfter]).toEqual([3, 5]);
  });

  it("a blank price in the sheet never wipes a price already set", async () => {
    await importWb(basic());
    await db.variant.updateMany({ data: { sellingPrice: 4500 } }); // e.g. owner priced it in admin
    await importWb(basic()); // sheet still has blank selling price
    const prices = await db.variant.findMany({ select: { sellingPrice: true } });
    expect(prices.every((p) => Number(p.sellingPrice) === 4500)).toBe(true);
  });

  it("dry run reports changes but saves nothing", async () => {
    const r = await importWb(basic(), { dryRun: true });
    expect(r).toMatchObject({ dryRun: true, productsCreated: 2, variantsCreated: 3 });
    expect(await db.product.count()).toBe(0);
    expect(await db.variant.count()).toBe(0);
    expect(await db.stockMovement.count()).toBe(0);
  });

  it("once orders exist, it refuses to overwrite stock unless told to", async () => {
    await importWb(basic());
    await db.order.create({
      data: {
        customerName: "A", email: "a@b.c", phone: "1", address: "x", city: "Lahore",
        paymentMethod: "COD", status: "NEW", subtotal: 0, shippingFee: 0, total: 0,
      },
    });
    const changed = workbook({
      Earrings: [ear(1, "Aveline pearl drop", "Gold", "Blue", 9), ear(1, "Aveline pearl drop", "Gold", "Green", 3)],
      Rings: [ring(2, "Caroline", "Gold", "None / Single", 8, 1)],
    });

    const protectedRun = await importWb(changed);
    expect(protectedRun.stockProtected).toBe(true);
    expect(protectedRun.issues).toContainEqual(expect.objectContaining({ message: expect.stringMatching(/NOT changed because orders exist/) }));
    const blue = () => db.variant.findFirstOrThrow({ where: { colour: "Blue" } });
    expect((await blue()).quantity).toBe(2);

    const forced = await importWb(changed, { overwriteStock: true });
    expect(forced.stockProtected).toBe(false);
    expect((await blue()).quantity).toBe(9);
  });

  it("rows removed from the sheet are reported, not deleted", async () => {
    await importWb(basic());
    const r = await importWb(workbook({ Earrings: [ear(1, "Aveline pearl drop", "Gold", "Blue", 2)] }));
    expect(r.notInSheet.map((n) => n.label).sort()).toEqual([
      "Aveline Pearl Drop / Gold / Green",
      "Caroline / Gold / None / Single / size 8",
    ]);
    expect(await db.variant.count()).toBe(3);
  });
});

// ---- the real workbook --------------------------------------------------

describe("real inventory workbook", () => {
  it("imports the real Lunara rows correctly", async () => {
    const parsed = parseWorkbook(await loadWorkbook(REAL_FILE));
    expect(parsed.issues.filter((i) => i.level === "error")).toEqual([]);
    await applyImport(db, parsed);

    const get = (category: "EARRINGS" | "RINGS" | "NECKLACE", articleNo: number) =>
      db.product.findUniqueOrThrow({
        where: { category_articleNo: { category, articleNo } },
        include: { variants: { orderBy: { id: "asc" } } },
      });

    const aveline = await get("EARRINGS", 1);
    expect(aveline.name).toBe("Aveline Pearl Drop");
    expect(aveline.variants.map((v) => `${v.sku} ${v.colour} ${v.quantity}`)).toEqual([
      "EAR-001-GD Blue 2", "EAR-001-GD Green 2", "EAR-001-GD Red 2",
      "EAR-001-SL Blue 2", "EAR-001-SL Green 2", "EAR-001-SL Red 2",
    ]);
    expect(Number(aveline.variants[0].costPrice)).toBe(2500);
    expect(aveline.variants[0].sellingPrice).toBeNull();

    expect((await get("EARRINGS", 2)).variants).toHaveLength(5);
    expect((await get("EARRINGS", 3)).variants.map((v) => v.quantity)).toEqual([4, 4, 1, 2]);

    // The two identical Caroline rows are merged into one row with quantity 2
    const caroline = await get("RINGS", 2);
    expect(caroline.variants.find((v) => v.size === "8")).toMatchObject({ sku: "RNG-002-GD", quantity: 2, colour: "None / Single" });

    expect((await get("RINGS", 1)).variants.find((v) => v.size === "9")).toMatchObject({ sku: "RNG-001-SL", quantity: 1 });

    expect((await get("NECKLACE", 1)).name).toBe("Whirls");
    expect((await get("NECKLACE", 3)).name).toBe("Aura Drop");
    expect((await get("NECKLACE", 3)).variants.map((v) => v.colour)).toEqual(["Blue", "Green"]);

    // No SKU anywhere still carries the old LN- prefix
    expect(await db.variant.count({ where: { sku: { startsWith: "LN-" } } })).toBe(0);
  });
});

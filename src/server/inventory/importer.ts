import ExcelJS from "exceljs";
import type { Category, Finish, PrismaClient } from "@/generated/prisma/client";
import {
  capitaliseName,
  generateSku,
  generateSlug,
  normaliseColour,
  normaliseFinish,
  normaliseRingSize,
} from "./catalog-rules";

// ------------------------------------------------------------
// Reads data/Lunara_Inventory_System_FINAL.xlsx into the database.
//
//  parseWorkbook()  — read + validate the sheet, no database access
//  applyImport()    — write the parsed rows to the database, returns a report
// ------------------------------------------------------------

const SHEETS: { sheet: string; category: Category }[] = [
  { sheet: "Earrings", category: "EARRINGS" },
  { sheet: "Rings", category: "RINGS" },
  { sheet: "Bracelets", category: "BRACELETS" },
  { sheet: "Necklace", category: "NECKLACE" },
];

// Header text in row 1 → field. Matched loosely (case/punctuation-insensitive).
const HEADERS = {
  articleNo: "articleno",
  name: "productname",
  finish: "finish",
  colour: "colour",
  size: "size",
  quantity: "quantity",
  costPrice: "costprice",
  sellingPrice: "sellingprice",
  photoRef: "photoref",
} as const;
type Field = keyof typeof HEADERS;

export type Issue = { level: "error" | "warning"; where: string; message: string };

export type ParsedVariant = {
  category: Category;
  articleNo: number;
  name: string;
  finish: Finish;
  colour: string;
  size: string;
  quantity: number;
  costPrice: number | null;
  sellingPrice: number | null;
  photoRef: string | null;
  sku: string;
  sourceRows: string[]; // e.g. ["Rings!3", "Rings!4"] when duplicates were merged
};

export type ParseResult = { variants: ParsedVariant[]; issues: Issue[] };

function cellValue(cell: ExcelJS.Cell): string | number | null {
  let v: unknown = cell.value;
  if (v && typeof v === "object") {
    if ("result" in v) v = (v as { result?: unknown }).result; // formula cell
    else if ("richText" in v) v = (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    else if ("text" in v) v = (v as { text: unknown }).text; // hyperlink
    else if (v instanceof Date) v = v.toISOString();
  }
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toNumber(v: string | number | null): number | null | "invalid" {
  if (v === null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : "invalid";
}

export async function loadWorkbook(path: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  return wb;
}

export function parseWorkbook(wb: ExcelJS.Workbook): ParseResult {
  const issues: Issue[] = [];
  const merged = new Map<string, ParsedVariant>();
  const namesByArticle = new Map<string, string>();

  for (const { sheet: sheetName, category } of SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) {
      issues.push({ level: "warning", where: sheetName, message: "Sheet not found — skipped" });
      continue;
    }

    // Map header names → column numbers
    const cols: Partial<Record<Field, number>> = {};
    ws.getRow(1).eachCell((cell, col) => {
      const key = String(cellValue(cell) ?? "").toLowerCase().replace(/[^a-z]/g, "");
      for (const [field, header] of Object.entries(HEADERS) as [Field, string][]) {
        if (key === header) cols[field] = col;
      }
    });
    const required: Field[] = ["articleNo", "name", "finish", "colour", "quantity"];
    if (category === "RINGS") required.push("size");
    const missing = required.filter((f) => !cols[f]);
    if (missing.length) {
      issues.push({ level: "error", where: sheetName, message: `Missing column(s): ${missing.join(", ")} — sheet skipped` });
      continue;
    }

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (f: Field) => (cols[f] ? cellValue(row.getCell(cols[f]!)) : null);
      const where = `${sheetName}!${r}`;
      const raw = {
        articleNo: get("articleNo"),
        name: get("name"),
        finish: get("finish"),
        colour: get("colour"),
        size: get("size"),
        quantity: get("quantity"),
        costPrice: get("costPrice"),
        sellingPrice: get("sellingPrice"),
        photoRef: get("photoRef"),
      };
      // Blank row (the SKU/Status formula columns don't count as data)
      if (Object.values(raw).every((v) => v === null)) continue;
      // A row with only a default colour and nothing else is also treated as blank
      if (
        raw.articleNo === null && raw.name === null && raw.finish === null &&
        raw.quantity === null && raw.size === null
      ) continue;

      const errors: string[] = [];

      const articleNum = toNumber(raw.articleNo);
      const articleNo = typeof articleNum === "number" && Number.isInteger(articleNum) && articleNum > 0 ? articleNum : null;
      if (articleNo === null) errors.push("Article No. missing or not a whole number above 0");

      const name = raw.name === null ? "" : capitaliseName(String(raw.name));
      if (!name) errors.push("Product Name missing");

      const finish = normaliseFinish(raw.finish === null ? null : String(raw.finish));
      if (!finish) errors.push(`Finish must be Gold or Silver (got "${raw.finish ?? ""}")`);

      const colour = normaliseColour(raw.colour === null ? null : String(raw.colour));
      if (!colour) errors.push(`Colour "${raw.colour}" is not in the colour list`);

      let size = "";
      if (category === "RINGS") {
        size = normaliseRingSize(raw.size);
        if (!size) errors.push("Ring Size missing");
      } else if (raw.size !== null) {
        issues.push({ level: "warning", where, message: "Size is only used for rings — ignored" });
      }

      let quantity = 0;
      const q = toNumber(raw.quantity);
      if (q === null) {
        issues.push({ level: "warning", where, message: "Quantity blank — imported as 0" });
      } else if (q === "invalid" || !Number.isInteger(q) || q < 0) {
        errors.push(`Quantity must be a whole number 0 or more (got "${raw.quantity}")`);
      } else quantity = q;

      const price = (field: "costPrice" | "sellingPrice", label: string) => {
        const p = toNumber(raw[field]);
        if (p === null) return null;
        if (p === "invalid" || p < 0) {
          errors.push(`${label} must be a number 0 or more (got "${raw[field]}")`);
          return null;
        }
        // 0 means "not filled in yet" — a 0 selling price would make the item free on the website.
        if (p === 0) {
          if (field === "sellingPrice") {
            issues.push({ level: "warning", where, message: "Selling Price is 0 — treated as not priced yet" });
          }
          return null;
        }
        return Math.round(p * 100) / 100;
      };
      const costPrice = price("costPrice", "Cost Price");
      const sellingPrice = price("sellingPrice", "Selling Price");

      if (errors.length) {
        for (const message of errors) issues.push({ level: "error", where, message: `${message} — row skipped` });
        continue;
      }

      // Same article must have one name
      const articleKey = `${category}:${articleNo}`;
      const knownName = namesByArticle.get(articleKey);
      if (knownName && knownName !== name) {
        issues.push({ level: "warning", where, message: `Name "${name}" differs from "${knownName}" used for the same article — using "${knownName}"` });
      } else if (!knownName) namesByArticle.set(articleKey, name);

      const v: ParsedVariant = {
        category,
        articleNo: articleNo!,
        name: namesByArticle.get(articleKey)!,
        finish: finish!,
        colour: colour!,
        size,
        quantity,
        costPrice,
        sellingPrice,
        photoRef: raw.photoRef === null ? null : String(raw.photoRef),
        sku: generateSku(category, articleNo!, finish!),
        sourceRows: [where],
      };

      const key = `${category}|${v.articleNo}|${v.finish}|${v.colour}|${v.size}`;
      const existing = merged.get(key);
      if (existing) {
        existing.quantity += v.quantity;
        existing.sourceRows.push(where);
        existing.costPrice ??= v.costPrice;
        existing.sellingPrice ??= v.sellingPrice;
        existing.photoRef ??= v.photoRef;
        issues.push({
          level: "warning",
          where,
          message: `Duplicate of ${existing.sourceRows[0]} (same design, finish, colour${category === "RINGS" ? ", size" : ""}) — merged, quantity now ${existing.quantity}`,
        });
      } else merged.set(key, v);
    }
  }

  return { variants: [...merged.values()], issues };
}

// ------------------------------------------------------------
// Database write
// ------------------------------------------------------------

export type ImportOptions = {
  /** Compute the report but roll everything back. */
  dryRun?: boolean;
  /** Allow quantities of existing rows to be replaced even though orders exist. */
  overwriteStock?: boolean;
};

export type ImportReport = {
  dryRun: boolean;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  variantsUnchanged: number;
  stockChanges: { sku: string; label: string; from: number; to: number }[];
  missingSellingPrice: number;
  missingPhotoRef: number;
  notInSheet: { sku: string; label: string }[];
  stockProtected: boolean;
  issues: Issue[];
};

class DryRunRollback extends Error {}

const label = (v: { name: string; colour: string; size: string; finish: Finish }) =>
  [v.name, v.finish === "GOLD" ? "Gold" : "Silver", v.colour, v.size && `size ${v.size}`].filter(Boolean).join(" / ");

const sameMoney = (a: { toString(): string } | null, b: number | null) =>
  (a === null && b === null) || (a !== null && b !== null && Number(a.toString()) === b);

export async function applyImport(db: PrismaClient, parsed: ParseResult, opts: ImportOptions = {}): Promise<ImportReport> {
  const report: ImportReport = {
    dryRun: !!opts.dryRun,
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    variantsUnchanged: 0,
    stockChanges: [],
    missingSellingPrice: 0,
    missingPhotoRef: 0,
    notInSheet: [],
    stockProtected: false,
    issues: [...parsed.issues],
  };

  const orderCount = await db.order.count();
  report.stockProtected = orderCount > 0 && !opts.overwriteStock;

  try {
    await db.$transaction(
      async (tx) => {
        const seenVariantIds = new Set<number>();
        const productIds = new Map<string, number>();

        for (const v of parsed.variants) {
          // --- Product (design) ---
          const pKey = `${v.category}:${v.articleNo}`;
          let productId = productIds.get(pKey);
          if (productId === undefined) {
            const existing = await tx.product.findUnique({
              where: { category_articleNo: { category: v.category, articleNo: v.articleNo } },
            });
            if (!existing) {
              const created = await tx.product.create({
                data: {
                  category: v.category,
                  articleNo: v.articleNo,
                  name: v.name,
                  slug: generateSlug(v.name, v.category, v.articleNo),
                },
              });
              productId = created.id;
              report.productsCreated++;
            } else {
              productId = existing.id;
              if (existing.name !== v.name) {
                // slug stays the same so existing links keep working
                await tx.product.update({ where: { id: existing.id }, data: { name: v.name } });
                report.productsUpdated++;
              }
            }
            productIds.set(pKey, productId);
          }

          // --- Variant (stock row) ---
          const where = {
            productId_finish_colour_size: { productId, finish: v.finish, colour: v.colour, size: v.size },
          };
          const existing = await tx.variant.findUnique({ where });

          if (!existing) {
            const created = await tx.variant.create({
              data: {
                productId,
                finish: v.finish,
                colour: v.colour,
                size: v.size,
                sku: v.sku,
                quantity: v.quantity,
                costPrice: v.costPrice,
                sellingPrice: v.sellingPrice,
                photoRef: v.photoRef,
              },
            });
            seenVariantIds.add(created.id);
            report.variantsCreated++;
            if (v.quantity !== 0) {
              await tx.stockMovement.create({
                data: { variantId: created.id, change: v.quantity, quantityAfter: v.quantity, reason: "IMPORT", note: v.sourceRows.join(", ") },
              });
              report.stockChanges.push({ sku: v.sku, label: label(v), from: 0, to: v.quantity });
            }
          } else {
            seenVariantIds.add(existing.id);
            // Blank cells in the sheet never wipe values the owner already set (e.g. in the admin panel).
            const data: Record<string, unknown> = {};
            if (existing.sku !== v.sku) data.sku = v.sku;
            if (v.costPrice !== null && !sameMoney(existing.costPrice, v.costPrice)) data.costPrice = v.costPrice;
            if (v.sellingPrice !== null && !sameMoney(existing.sellingPrice, v.sellingPrice)) data.sellingPrice = v.sellingPrice;
            if (v.photoRef !== null && existing.photoRef !== v.photoRef) data.photoRef = v.photoRef;

            const qtyDiffers = existing.quantity !== v.quantity;
            if (qtyDiffers && report.stockProtected) {
              report.issues.push({
                level: "warning",
                where: v.sourceRows[0],
                message: `${label(v)}: sheet says ${v.quantity}, website has ${existing.quantity} — NOT changed because orders exist (use --overwrite-stock)`,
              });
            } else if (qtyDiffers) {
              data.quantity = v.quantity;
            }

            if (Object.keys(data).length) {
              await tx.variant.update({ where: { id: existing.id }, data });
              report.variantsUpdated++;
              if ("quantity" in data) {
                await tx.stockMovement.create({
                  data: {
                    variantId: existing.id,
                    change: v.quantity - existing.quantity,
                    quantityAfter: v.quantity,
                    reason: "IMPORT",
                    note: v.sourceRows.join(", "),
                  },
                });
                report.stockChanges.push({ sku: v.sku, label: label(v), from: existing.quantity, to: v.quantity });
              }
            } else report.variantsUnchanged++;
          }
        }

        // Rows in the database that the sheet no longer has — reported, never deleted.
        const others = await tx.variant.findMany({
          where: { id: { notIn: [...seenVariantIds] } },
          include: { product: true },
        });
        report.notInSheet = others.map((o) => ({ sku: o.sku, label: label({ ...o, name: o.product.name }) }));

        const all = await tx.variant.findMany({ select: { sellingPrice: true, photoRef: true } });
        report.missingSellingPrice = all.filter((x) => x.sellingPrice === null).length;
        report.missingPhotoRef = all.filter((x) => !x.photoRef).length;

        if (opts.dryRun) throw new DryRunRollback();
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }

  return report;
}

export function formatReport(r: ImportReport): string {
  const lines: string[] = [];
  lines.push(r.dryRun ? "=== INVENTORY IMPORT — PREVIEW (nothing saved) ===" : "=== INVENTORY IMPORT — SAVED ===");
  lines.push(`Designs:    ${r.productsCreated} new, ${r.productsUpdated} renamed`);
  lines.push(`Stock rows: ${r.variantsCreated} new, ${r.variantsUpdated} updated, ${r.variantsUnchanged} unchanged`);
  if (r.stockProtected) lines.push("Stock quantities of existing rows were PROTECTED because orders exist.");
  if (r.stockChanges.length) {
    lines.push("", "Stock changes:");
    for (const c of r.stockChanges) lines.push(`  ${c.sku.padEnd(11)} ${c.label}: ${c.from} → ${c.to}`);
  }
  const errors = r.issues.filter((i) => i.level === "error");
  const warnings = r.issues.filter((i) => i.level === "warning");
  if (errors.length) {
    lines.push("", `Errors (${errors.length}) — these rows were NOT imported:`);
    for (const i of errors) lines.push(`  ${i.where}: ${i.message}`);
  }
  if (warnings.length) {
    lines.push("", `Warnings (${warnings.length}):`);
    for (const i of warnings) lines.push(`  ${i.where}: ${i.message}`);
  }
  if (r.notInSheet.length) {
    lines.push("", `In the database but not in the sheet (${r.notInSheet.length}) — left untouched:`);
    for (const n of r.notInSheet) lines.push(`  ${n.sku.padEnd(11)} ${n.label}`);
  }
  lines.push("", "Still to fill in:");
  lines.push(`  ${r.missingSellingPrice} stock row(s) have no selling price (hidden on the website until priced)`);
  lines.push(`  ${r.missingPhotoRef} stock row(s) have no photo reference`);
  return lines.join("\n");
}

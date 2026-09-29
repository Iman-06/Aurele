import ExcelJS from "exceljs";
import type { Category, PrismaClient } from "@/generated/prisma/client";
import { FINISH_LABELS } from "./catalog-rules";
import { stockStatus } from "./stock";
import { getNumberSetting } from "../settings";

// "Export to Excel": the current inventory in the same layout as
// data/Lunara_Inventory_System_FINAL.xlsx (one tab per category), so it can be
// opened by the owner — and re-imported without changing anything.

const SHEETS: { sheet: string; category: Category }[] = [
  { sheet: "Earrings", category: "EARRINGS" },
  { sheet: "Rings", category: "RINGS" },
  { sheet: "Bracelets", category: "BRACELETS" },
  { sheet: "Necklace", category: "NECKLACE" },
];
const STD = ["SKU", "Article No.", "Product Name", "Finish", "Colour", "Quantity", "Cost Price", "Selling Price", "Status", "Photo Ref."];
const RING = ["SKU", "Article No.", "Product Name", "Finish", "Colour", "Size", "Quantity", "Cost Price", "Selling Price", "Status", "Photo Ref."];

const STATUS_TEXT = { OUT_OF_STOCK: "Out of Stock", LOW_STOCK: "Low Stock", IN_STOCK: "Available" } as const;

export async function buildInventoryWorkbook(db: PrismaClient, now = new Date()) {
  const threshold = await getNumberSetting(db, "low_stock_threshold");
  const variants = await db.variant.findMany({
    include: { product: { select: { name: true, category: true, articleNo: true } } },
    orderBy: [{ product: { articleNo: "asc" } }, { finish: "asc" }, { id: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lunara admin";
  wb.created = now;

  for (const { sheet, category } of SHEETS) {
    const isRing = category === "RINGS";
    const ws = wb.addWorksheet(sheet, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(isRing ? RING : STD);
    ws.getRow(1).font = { bold: true };

    for (const v of variants.filter((x) => x.product.category === category)) {
      const money = (d: { toString(): string } | null) => (d === null ? null : Number(d.toString()));
      const cells = [
        v.sku,
        v.product.articleNo,
        v.product.name,
        FINISH_LABELS[v.finish],
        v.colour,
        ...(isRing ? [v.size] : []),
        v.quantity,
        money(v.costPrice),
        money(v.sellingPrice),
        STATUS_TEXT[stockStatus(v.quantity, threshold).status],
        v.photoRef,
      ];
      ws.addRow(cells);
    }
    ws.columns.forEach((c, i) => {
      c.width = [14, 11, 26, 9, 16, ...(isRing ? [10] : []), 10, 12, 13, 13, 18][i] ?? 12;
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: (isRing ? RING : STD).length } };
  }

  return wb;
}

export async function inventoryWorkbookBuffer(db: PrismaClient, now = new Date()): Promise<Buffer> {
  const wb = await buildInventoryWorkbook(db, now);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

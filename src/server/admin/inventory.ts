import { z } from "zod";
import type { Category, Prisma, PrismaClient, StockMovementReason } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { stockStatus, type StockStatus } from "../inventory/stock";
import { getNumberSetting } from "../settings";

// Admin inventory: every stock row in one table, receiving stock, and stock history.
// Callers must check requireAdmin() first.

const CATEGORIES = ["EARRINGS", "RINGS", "BRACELETS", "NECKLACE"] as const;

export const inventoryFilter = z.object({
  q: z.string().trim().optional(),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  status: z.enum(["all", "out", "low", "hidden", "unpriced"]).default("all").catch("all"),
});

export type InventoryRow = {
  variantId: number;
  productId: number;
  productName: string;
  category: Category;
  articleNo: number;
  productActive: boolean;
  finish: "GOLD" | "SILVER";
  colour: string;
  size: string;
  sku: string;
  quantity: number;
  sellingPrice: number | null;
  costPrice: number | null;
  isActive: boolean;
  stock: StockStatus;
  updatedAt: Date;
};

export async function listInventory(db: PrismaClient, filter: z.input<typeof inventoryFilter> = {}) {
  const f = inventoryFilter.parse(filter);
  const threshold = await getNumberSetting(db, "low_stock_threshold");

  const where: Prisma.VariantWhereInput = {
    ...(f.category ? { product: { category: f.category } } : {}),
    ...(f.q
      ? {
          OR: [
            { sku: { contains: f.q, mode: "insensitive" } },
            { colour: { contains: f.q, mode: "insensitive" } },
            { product: { name: { contains: f.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(f.status === "out" ? { quantity: 0 } : {}),
    ...(f.status === "low" ? { quantity: { gt: 0, lte: threshold } } : {}),
    ...(f.status === "hidden" ? { OR: [{ isActive: false }, { product: { isActive: false } }] } : {}),
    ...(f.status === "unpriced" ? { sellingPrice: null } : {}),
  };

  const variants = await db.variant.findMany({
    where,
    include: { product: { select: { name: true, category: true, articleNo: true, isActive: true } } },
    orderBy: [{ product: { category: "asc" } }, { product: { articleNo: "asc" } }, { finish: "asc" }, { colour: "asc" }, { size: "asc" }],
  });

  const rows: InventoryRow[] = variants.map((v) => ({
    variantId: v.id,
    productId: v.productId,
    productName: v.product.name,
    category: v.product.category,
    articleNo: v.product.articleNo,
    productActive: v.product.isActive,
    finish: v.finish,
    colour: v.colour,
    size: v.size,
    sku: v.sku,
    quantity: v.quantity,
    sellingPrice: v.sellingPrice === null ? null : Number(v.sellingPrice),
    costPrice: v.costPrice === null ? null : Number(v.costPrice),
    isActive: v.isActive,
    stock: stockStatus(v.quantity, threshold),
    updatedAt: v.updatedAt,
  }));

  const totals = {
    rows: rows.length,
    pieces: rows.reduce((s, r) => s + r.quantity, 0),
    stockValueAtCost: rows.reduce((s, r) => s + (r.costPrice ?? 0) * r.quantity, 0),
    outOfStock: rows.filter((r) => r.quantity === 0).length,
    lowStock: rows.filter((r) => r.stock.status === "LOW_STOCK").length,
  };
  return { rows, totals, threshold };
}

/** Add incoming stock (e.g. a new delivery). Adds on top of whatever is there — no conflicts possible. */
export async function receiveStock(db: PrismaClient, input: { variantId: number; add: unknown; note?: string }) {
  const add = Number(String(input.add ?? "").trim());
  if (!Number.isInteger(add) || add < 1 || add > 100_000) {
    throw new DomainError("INVALID_INPUT", "Enter how many pieces arrived (a whole number, 1 or more)");
  }
  return db.$transaction(async (tx) => {
    const v = await tx.variant.update({
      where: { id: input.variantId },
      data: { quantity: { increment: add } },
      select: { quantity: true },
    }).catch(() => {
      throw new DomainError("NOT_FOUND", "Stock row not found");
    });
    await tx.stockMovement.create({
      data: {
        variantId: input.variantId,
        change: add,
        quantityAfter: v.quantity,
        reason: "ADMIN_ADJUST",
        note: input.note?.trim() || "Stock received",
      },
    });
    return v.quantity;
  });
}

export const REASON_LABELS: Record<StockMovementReason, string> = {
  IMPORT: "Excel import",
  ADMIN_ADJUST: "Admin",
  SALE: "Sale",
  ORDER_CANCELLED: "Order cancelled",
};

export async function getStockHistory(db: PrismaClient, variantId: number, limit = 200) {
  const variant = await db.variant.findUnique({
    where: { id: variantId },
    include: { product: { select: { id: true, name: true, category: true, articleNo: true } } },
  });
  if (!variant) return null;
  const movements = await db.stockMovement.findMany({
    where: { variantId },
    include: { order: { select: { id: true, orderNumber: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return { variant, movements };
}

// ------------------------------------------------------------
// Settings the owner can change
// ------------------------------------------------------------

export const settingsInput = z.object({
  shipping_fee: z.preprocess(
    (v) => Number(String(v ?? "").replace(/rs\.?/i, "").replace(/[,\s]/g, "")),
    z.number({ error: "Shipping fee must be a number" }).min(0, "Shipping fee can't be negative").max(100_000),
  ),
  low_stock_threshold: z.preprocess(
    (v) => Number(String(v ?? "").trim()),
    z.number().int("Low-stock limit must be a whole number").min(0, "Low-stock limit can't be negative").max(100),
  ),
});

export async function updateSettings(db: PrismaClient, input: Record<string, unknown>) {
  const r = settingsInput.safeParse(input);
  if (!r.success) throw new DomainError("INVALID_INPUT", r.error.issues[0]?.message ?? "Invalid settings");
  for (const [key, value] of Object.entries(r.data)) {
    await db.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  }
  return r.data;
}

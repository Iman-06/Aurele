import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DomainError, type Shortage } from "../errors";
import { FINISH_LABELS, NO_COLOUR } from "./catalog-rules";

type Tx = Prisma.TransactionClient;

// ------------------------------------------------------------
// Stock status shown to customers
// ------------------------------------------------------------

export type StockStatus =
  | { status: "OUT_OF_STOCK" }
  | { status: "LOW_STOCK"; left: number } // storefront shows "Only {left} left"
  | { status: "IN_STOCK" };

export function stockStatus(quantity: number, lowStockThreshold: number): StockStatus {
  if (quantity <= 0) return { status: "OUT_OF_STOCK" };
  if (quantity <= lowStockThreshold) return { status: "LOW_STOCK", left: quantity };
  return { status: "IN_STOCK" };
}

/** Human label for a stock row, e.g. "Aveline Pearl Drop — Gold, Blue" / "Caroline — Gold, size 8". */
export function variantLabel(v: { productName: string; finish: "GOLD" | "SILVER"; colour: string; size: string }) {
  const parts: string[] = [FINISH_LABELS[v.finish]];
  if (v.colour !== NO_COLOUR) parts.push(v.colour);
  if (v.size) parts.push(`size ${v.size}`);
  return `${v.productName} — ${parts.join(", ")}`;
}

// ------------------------------------------------------------
// Taking stock out / putting it back (always inside a transaction)
// ------------------------------------------------------------

export type StockLine = { variantId: number; quantity: number; label: string };

/**
 * Lock the stock rows, check every line has enough, then take them all — or take nothing.
 *
 * Rows are locked in id order (SELECT … FOR UPDATE), so two orders touching the same
 * items queue up instead of deadlocking, and the second one sees the first one's result.
 * This is what makes "first come, first served" hold even for simultaneous clicks.
 *
 * Returns the shortages (empty = success). On shortage nothing is changed.
 */
export async function takeStock(tx: Tx, lines: StockLine[], orderId: number): Promise<Shortage[]> {
  const ids = [...new Set(lines.map((l) => l.variantId))].sort((a, b) => a - b);
  const rows = await tx.$queryRaw<{ id: number; quantity: number; isActive: boolean }[]>`
    SELECT id, quantity, "isActive" FROM "Variant" WHERE id = ANY(${ids}::int[]) ORDER BY id FOR UPDATE`;
  const byId = new Map(rows.map((r) => [r.id, r]));

  const shortages: Shortage[] = [];
  for (const l of lines) {
    const row = byId.get(l.variantId);
    const available = row && row.isActive ? row.quantity : 0;
    if (available < l.quantity) {
      shortages.push({ variantId: l.variantId, label: l.label, requested: l.quantity, available });
    }
  }
  if (shortages.length) return shortages;

  for (const l of lines) {
    const updated = await tx.variant.update({
      where: { id: l.variantId },
      data: { quantity: { decrement: l.quantity } },
      select: { quantity: true },
    });
    await tx.stockMovement.create({
      data: { variantId: l.variantId, orderId, change: -l.quantity, quantityAfter: updated.quantity, reason: "SALE" },
    });
  }
  return [];
}

/** Put an order's items back into stock (used when an order that had taken stock is cancelled). */
export async function returnStock(tx: Tx, orderId: number, note?: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, orderBy: { variantId: "asc" } });
  for (const item of items) {
    const updated = await tx.variant.update({
      where: { id: item.variantId },
      data: { quantity: { increment: item.quantity } },
      select: { quantity: true },
    });
    await tx.stockMovement.create({
      data: {
        variantId: item.variantId,
        orderId,
        change: item.quantity,
        quantityAfter: updated.quantity,
        reason: "ORDER_CANCELLED",
        note,
      },
    });
  }
}

// ------------------------------------------------------------
// Owner edits a quantity in the admin panel
// ------------------------------------------------------------

/**
 * Set a stock row to a new quantity. `expectedQuantity` is the number the owner was looking at;
 * if a sale happened in the meantime the edit is refused (STOCK_CONFLICT) instead of silently
 * overwriting it — the admin UI then reloads and shows the current number.
 */
export async function adjustStock(
  db: PrismaClient,
  input: { variantId: number; expectedQuantity: number; newQuantity: number; note?: string },
) {
  const { variantId, expectedQuantity, newQuantity, note } = input;
  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new DomainError("INVALID_INPUT", "Quantity must be a whole number, 0 or more");
  }
  return db.$transaction(async (tx) => {
    const res = await tx.variant.updateMany({
      where: { id: variantId, quantity: expectedQuantity },
      data: { quantity: newQuantity },
    });
    if (res.count === 0) {
      const current = await tx.variant.findUnique({ where: { id: variantId }, select: { quantity: true } });
      if (!current) throw new DomainError("NOT_FOUND", "Stock row not found");
      throw new DomainError(
        "STOCK_CONFLICT",
        `Stock changed to ${current.quantity} while you were editing (e.g. a sale). Please check and try again.`,
        { currentQuantity: current.quantity },
      );
    }
    if (newQuantity !== expectedQuantity) {
      await tx.stockMovement.create({
        data: {
          variantId,
          change: newQuantity - expectedQuantity,
          quantityAfter: newQuantity,
          reason: "ADMIN_ADJUST",
          note,
        },
      });
    }
    return { variantId, quantity: newQuantity };
  });
}

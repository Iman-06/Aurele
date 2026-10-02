import type { CartLine, CartSummary } from "@/server/catalog/catalog";
import type { StockStatus } from "@/server/inventory/stock";
import type { Finish } from "@/generated/prisma/client";

// Shared cart contract for the storefront and checkout. Safe to import from client
// components: everything here is type-only or a plain constant, so nothing server-side
// is pulled into the browser bundle.

export type { CartLine, CartSummary, StockStatus, Finish };

/**
 * One line of the customer's cart, as kept in localStorage.
 *
 * `priceAtAdd` is the price the customer saw when they added the item and is for
 * DISPLAY ONLY — prices always come from the database, never the browser. Send it to
 * `POST /api/cart/validate` as `price` so the backend can flag a change, but never
 * treat it as the amount to charge.
 */
export type CartItem = {
  variantId: number;
  productId: number;
  name: string;
  finish: Finish;
  colour: string; // "None / Single" when the design has no colour choice — don't display it
  size: string; // "" for anything that isn't a ring
  photoRef: string | null; // image URL from the catalog API, for the cart thumbnail
  quantity: number;
  priceAtAdd: number;
};

/** Colour value meaning "this design has no colour choice" — never show this text. */
export const NO_COLOUR = "None / Single";

/** The backend rejects more than 20 of one item per order, and more than 50 lines. */
export const MAX_PER_ITEM = 20;
export const MAX_LINES = 50;

/** Fallback only — the real figure comes from the API (`shippingFee`). */
export const FALLBACK_SHIPPING_FEE = 250;

/**
 * How many of a variant the customer may still pick, given live stock.
 * Exact numbers are only exposed at or below the low-stock threshold, so above it we
 * can only cap at the per-order maximum.
 */
export function maxQuantityFor(stock: StockStatus): number {
  if (stock.status === "OUT_OF_STOCK") return 0;
  if (stock.status === "LOW_STOCK") return Math.min(stock.left, MAX_PER_ITEM);
  return MAX_PER_ITEM;
}

export type ValidateCartRequest = {
  items: { variantId: number; quantity: number; price?: number }[];
};

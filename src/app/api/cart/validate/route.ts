import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCart } from "@/server/catalog/catalog";
import { handleError, readJson } from "@/server/http";

// POST /api/cart/validate  { items: [{ variantId, quantity, price? }] }
// Refreshes a saved cart: current prices, stock, "Only N left", sold-out / reduced lines, totals.
export async function POST(req: Request) {
  try {
    return NextResponse.json(await validateCart(db, (await readJson(req)) as never));
  } catch (e) {
    return handleError(e);
  }
}

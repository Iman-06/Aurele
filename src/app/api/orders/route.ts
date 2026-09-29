import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleError, readJson } from "@/server/http";
import { placeOrder, type PlaceOrderInput } from "@/server/orders/orders";
import { toPublicOrder } from "@/server/orders/public-order";

// POST /api/orders  { items: [{ variantId, quantity }], customer: {...}, paymentMethod: "COD" | "JAZZCASH" }
// COD → 201 with a NEW order (stock taken). JAZZCASH → 201 with AWAITING_PAYMENT; checkout then
// sends the customer to JazzCash with orderNumber + total. Prices are always taken from the database.
export async function POST(req: Request) {
  try {
    const order = await placeOrder(db, (await readJson(req)) as PlaceOrderInput);
    return NextResponse.json(toPublicOrder(order), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

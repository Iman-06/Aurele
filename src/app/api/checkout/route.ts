import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DomainError } from "@/server/errors";
import { handleError, readJson } from "@/server/http";
import { placeOrderInput } from "@/server/orders/orders";
import { getPaymentProvider } from "@/server/payments/registry";

// POST /api/checkout
// Body matches POST /api/orders: { items: [{ variantId, quantity }], customer, paymentMethod }.
// Prices and stock are recomputed in Track 2 placeOrder. Phase 1 only enables COD.
// Duplicate-submit protection is client-side (disable the button) until a schema column is agreed.

export async function POST(req: Request) {
  try {
    const raw = await readJson(req);
    const parsed = placeOrderInput.safeParse(raw);
    if (!parsed.success) {
      throw new DomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid checkout", parsed.error.issues);
    }
    const result = await getPaymentProvider(parsed.data.paymentMethod).createPayment(db, {
      ...parsed.data,
      customer: {
        ...parsed.data.customer,
        postalCode: parsed.data.customer.postalCode ?? undefined,
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

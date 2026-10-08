import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as checkoutRoute } from "@/app/api/checkout/route";
import { DomainError } from "@/server/errors";
import { getPaymentProvider, CHECKOUT_ENABLED_METHODS } from "@/server/payments/registry";
import { ensureDefaultSettings } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";
import { createDesign } from "./helpers/fixtures";

const BASE = "http://localhost:3000";
const post = (body: unknown) =>
  new NextRequest(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const customer = {
  name: "Sara Ahmed",
  email: "sara@example.com",
  phone: "03211234567",
  address: "12 Mall Road",
  city: "Lahore",
};

beforeEach(async () => {
  await resetDb();
  await ensureDefaultSettings(db);
});
afterAll(() => db.$disconnect());

describe("payment registry", () => {
  it("enables only COD until JazzCash is implemented", () => {
    expect(CHECKOUT_ENABLED_METHODS).toEqual(["COD"]);
    expect(getPaymentProvider("COD").method).toBe("COD");
    expect(getPaymentProvider("JAZZCASH").method).toBe("JAZZCASH");
  });

  it("rejects an unknown method", () => {
    expect(() => getPaymentProvider("BITCOIN")).toThrow(DomainError);
  });
});

describe("POST /api/checkout", () => {
  it("creates a COD order using database prices and takes stock", async () => {
    const p = await createDesign({
      name: "Aveline",
      variants: [{ finish: "GOLD", colour: "Blue", qty: 3, price: 2500 }],
    });

    const res = await checkoutRoute(
      post({ items: [{ variantId: p.variants[0].id, quantity: 2 }], customer, paymentMethod: "COD" }),
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.next).toEqual({ type: "CONFIRMATION" });
    expect(body.order).toMatchObject({
      status: "NEW",
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      subtotal: 5000,
      shippingFee: 250,
      total: 5250,
      items: [{ name: "Aveline", quantity: 2, unitPrice: 2500, lineTotal: 5000 }],
    });
    expect(body.order.orderNumber).toMatch(/^\d{5,}$/);
    expect(JSON.stringify(body)).not.toMatch(/"id"|variantId|stockDeductedAt|EAR-\d{3}/);
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).quantity).toBe(1);
  });

  it("ignores a browser-sent price and charges the database price", async () => {
    const p = await createDesign({
      name: "Aveline",
      variants: [{ finish: "GOLD", qty: 2, price: 2500 }],
    });

    const res = await checkoutRoute(
      post({
        items: [{ variantId: p.variants[0].id, quantity: 1, unitPrice: 1 }],
        customer,
        paymentMethod: "COD",
        total: 1,
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).order.total).toBe(2750);
  });

  it("409 when sold out; 400 for empty cart, bad details, or JazzCash (not enabled yet)", async () => {
    const p = await createDesign({
      name: "Aveline",
      variants: [{ finish: "GOLD", colour: "Blue", qty: 0, price: 2500 }],
    });

    const sold = await checkoutRoute(
      post({ items: [{ variantId: p.variants[0].id, quantity: 1 }], customer, paymentMethod: "COD" }),
    );
    expect(sold.status).toBe(409);
    expect((await sold.json()).error.code).toBe("OUT_OF_STOCK");

    const empty = await checkoutRoute(post({ items: [], customer, paymentMethod: "COD" }));
    expect(empty.status).toBe(400);

    const badPhone = await checkoutRoute(
      post({
        items: [{ variantId: p.variants[0].id, quantity: 1 }],
        customer: { ...customer, phone: "abc" },
        paymentMethod: "COD",
      }),
    );
    expect(badPhone.status).toBe(400);

    const jazz = await checkoutRoute(
      post({ items: [{ variantId: p.variants[0].id, quantity: 1 }], customer, paymentMethod: "JAZZCASH" }),
    );
    expect(jazz.status).toBe(400);
    expect((await jazz.json()).error.message).toMatch(/JazzCash is not available yet/i);
  });

  it("does not treat a client idempotency header as a unique order key (no schema column yet)", async () => {
    const p = await createDesign({
      name: "Aveline",
      variants: [{ finish: "GOLD", qty: 5, price: 2500 }],
    });
    const body = { items: [{ variantId: p.variants[0].id, quantity: 1 }], customer, paymentMethod: "COD" };

    const first = await checkoutRoute(
      new NextRequest(`${BASE}/api/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "same-click" },
        body: JSON.stringify(body),
      }),
    );
    const second = await checkoutRoute(
      new NextRequest(`${BASE}/api/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "same-click" },
        body: JSON.stringify(body),
      }),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await first.json()).order.orderNumber).not.toBe((await second.json()).order.orderNumber);
    expect(await db.order.count()).toBe(2);
  });
});

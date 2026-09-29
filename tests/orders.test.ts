import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/server/errors";
import { adjustStock, stockStatus } from "@/server/inventory/stock";
import {
  abandonUnpaidOrders,
  cancelOrder,
  confirmJazzCashPayment,
  markRefunded,
  placeOrder,
  updateOrderStatus,
  type PlaceOrderInput,
} from "@/server/orders/orders";
import { ensureDefaultSettings } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";

// ---- helpers ------------------------------------------------------------

let articleNo = 0;
async function makeVariant(opts: { quantity: number; price?: number | null; colour?: string; active?: boolean; productActive?: boolean }) {
  articleNo++;
  const p = await db.product.create({
    data: { category: "EARRINGS", articleNo, name: `Design ${articleNo}`, slug: `design-${articleNo}`, isActive: opts.productActive ?? true },
  });
  return db.variant.create({
    data: {
      productId: p.id,
      finish: "GOLD",
      colour: opts.colour ?? "Blue",
      sku: `EAR-${String(articleNo).padStart(3, "0")}-GD`,
      quantity: opts.quantity,
      sellingPrice: opts.price === undefined ? 2500 : opts.price,
      isActive: opts.active ?? true,
    },
  });
}

const customer = {
  name: "Ayesha Khan",
  email: "  Ayesha@Example.com ",
  phone: "0300-1234567",
  address: "House 12, Street 4, DHA Phase 5",
  city: "Lahore",
};

const cod = (items: PlaceOrderInput["items"]): PlaceOrderInput => ({ items, customer, paymentMethod: "COD" });
const jazz = (items: PlaceOrderInput["items"]): PlaceOrderInput => ({ items, customer, paymentMethod: "JAZZCASH" });

const qty = async (id: number) => (await db.variant.findUniqueOrThrow({ where: { id } })).quantity;

async function expectDomainError(p: Promise<unknown>, code: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err, `expected DomainError ${code}`).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
  return err as DomainError;
}

beforeEach(async () => {
  await resetDb();
  await ensureDefaultSettings(db); // shipping 250, low stock 3
});
afterAll(() => db.$disconnect());

// ---- stock status -------------------------------------------------------

describe("stockStatus", () => {
  it("0 → out of stock, 1–3 → 'Only N left', 4+ → in stock", () => {
    expect(stockStatus(0, 3)).toEqual({ status: "OUT_OF_STOCK" });
    expect(stockStatus(1, 3)).toEqual({ status: "LOW_STOCK", left: 1 });
    expect(stockStatus(3, 3)).toEqual({ status: "LOW_STOCK", left: 3 });
    expect(stockStatus(4, 3)).toEqual({ status: "IN_STOCK" });
  });
});

// ---- COD ----------------------------------------------------------------

describe("COD orders", () => {
  it("take stock immediately, use database prices and the Rs 250 shipping fee", async () => {
    const a = await makeVariant({ quantity: 5, price: 2500 });
    const b = await makeVariant({ quantity: 2, price: 3000 });

    const order = await placeOrder(db, cod([{ variantId: a.id, quantity: 2 }, { variantId: b.id, quantity: 1 }]));

    expect(order.status).toBe("NEW");
    expect(order.paymentStatus).toBe("UNPAID");
    expect(Number(order.subtotal)).toBe(8000);
    expect(Number(order.shippingFee)).toBe(250);
    expect(Number(order.total)).toBe(8250);
    expect(order.email).toBe("ayesha@example.com");
    expect(order.stockDeductedAt).not.toBeNull();
    expect(Number(order.orderNumber)).toBeGreaterThanOrEqual(10001);

    expect(await qty(a.id)).toBe(3);
    expect(await qty(b.id)).toBe(1);

    const moves = await db.stockMovement.findMany({ where: { orderId: order.id }, orderBy: { variantId: "asc" } });
    expect(moves.map((m) => [m.change, m.quantityAfter, m.reason])).toEqual([[-2, 3, "SALE"], [-1, 1, "SALE"]]);
  });

  it("snapshots the item so later price/name changes don't alter the order", async () => {
    const a = await makeVariant({ quantity: 5, price: 2500 });
    const order = await placeOrder(db, cod([{ variantId: a.id, quantity: 1 }]));
    await db.variant.update({ where: { id: a.id }, data: { sellingPrice: 9999 } });
    await db.product.updateMany({ data: { name: "Renamed" } });

    const item = (await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } }));
    expect(Number(item.priceAtSale)).toBe(2500);
    expect(item.productName).toBe("Design 1".replace("1", String(articleNo)));
    expect(item).toMatchObject({ sku: a.sku, finish: "GOLD", colour: "Blue", size: "" });
  });

  it("ignores any price sent from the browser", async () => {
    const a = await makeVariant({ quantity: 5, price: 2500 });
    const tampered = { ...cod([{ variantId: a.id, quantity: 1 }]), items: [{ variantId: a.id, quantity: 1, price: 1 }] };
    const order = await placeOrder(db, tampered as PlaceOrderInput);
    expect(Number(order.subtotal)).toBe(2500);
  });

  it("merges the same item added twice", async () => {
    const a = await makeVariant({ quantity: 5 });
    const order = await placeOrder(db, cod([{ variantId: a.id, quantity: 1 }, { variantId: a.id, quantity: 2 }]));
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(3);
    expect(await qty(a.id)).toBe(2);
  });

  it("is all-or-nothing: one sold-out item means no order and no stock taken", async () => {
    const a = await makeVariant({ quantity: 5 });
    const b = await makeVariant({ quantity: 0 });
    const err = await expectDomainError(
      placeOrder(db, cod([{ variantId: a.id, quantity: 1 }, { variantId: b.id, quantity: 1 }])),
      "OUT_OF_STOCK",
    );
    expect(err.message).toMatch(/Design \d+ — Gold, Blue is sold out/);
    expect(await qty(a.id)).toBe(5);
    expect(await db.order.count()).toBe(0);
  });

  it("says how many are left when asking for more than available", async () => {
    const a = await makeVariant({ quantity: 2 });
    const err = await expectDomainError(placeOrder(db, cod([{ variantId: a.id, quantity: 3 }])), "OUT_OF_STOCK");
    expect(err.message).toMatch(/^Only 2 left of/);
  });

  it("rejects unpriced, owner-hidden and unknown items", async () => {
    const unpriced = await makeVariant({ quantity: 5, price: null });
    const hidden = await makeVariant({ quantity: 5, active: false });
    const hiddenDesign = await makeVariant({ quantity: 5, productActive: false });
    for (const id of [unpriced.id, hidden.id, hiddenDesign.id, 999999]) {
      await expectDomainError(placeOrder(db, cod([{ variantId: id, quantity: 1 }])), "NOT_PURCHASABLE");
    }
    expect(await db.order.count()).toBe(0);
  });

  it("validates customer details", async () => {
    const a = await makeVariant({ quantity: 5 });
    const bad = (c: Partial<typeof customer>) =>
      placeOrder(db, { items: [{ variantId: a.id, quantity: 1 }], customer: { ...customer, ...c }, paymentMethod: "COD" });
    await expectDomainError(bad({ email: "not-an-email" }), "INVALID_INPUT");
    await expectDomainError(bad({ phone: "abc" }), "INVALID_INPUT");
    await expectDomainError(bad({ name: "" }), "INVALID_INPUT");
    await expectDomainError(placeOrder(db, cod([])), "INVALID_INPUT");
    await expectDomainError(placeOrder(db, cod([{ variantId: a.id, quantity: 0 }])), "INVALID_INPUT");
  });
});

// ---- first come, first served -------------------------------------------

describe("simultaneous orders (no reservations, first come first served)", () => {
  it("two COD orders for the last piece at the same moment → exactly one wins", async () => {
    const a = await makeVariant({ quantity: 1 });
    const results = await Promise.allSettled([
      placeOrder(db, cod([{ variantId: a.id, quantity: 1 }])),
      placeOrder(db, cod([{ variantId: a.id, quantity: 1 }])),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as DomainError).code).toBe("OUT_OF_STOCK");
    expect(await qty(a.id)).toBe(0);
    expect(await db.order.count()).toBe(1);
  });

  it("10 customers, 3 in stock → exactly 3 orders, stock ends at 0, never negative", async () => {
    const a = await makeVariant({ quantity: 3 });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => placeOrder(db, cod([{ variantId: a.id, quantity: 1 }]))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await qty(a.id)).toBe(0);
    expect(await db.order.count()).toBe(3);
    expect(await db.stockMovement.count({ where: { reason: "SALE" } })).toBe(3);
  });

  it("overlapping carts in opposite order (COD + JazzCash mixed) never deadlock", async () => {
    const a = await makeVariant({ quantity: 10 });
    const b = await makeVariant({ quantity: 10 });
    const ab = [{ variantId: a.id, quantity: 1 }, { variantId: b.id, quantity: 1 }];
    const ba = [{ variantId: b.id, quantity: 1 }, { variantId: a.id, quantity: 1 }];
    const results = await Promise.allSettled(
      Array.from({ length: 16 }, (_, i) => placeOrder(db, (i % 4 < 2 ? cod : jazz)(i % 2 ? ab : ba))),
    );
    expect(results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason).slice(0, 200))).toEqual([]);
    // 8 COD orders took stock; 8 JazzCash orders took nothing (no reservation)
    expect([await qty(a.id), await qty(b.id)]).toEqual([2, 2]);
  });

  it("COD order and JazzCash payment racing for the last piece → exactly one gets it", async () => {
    const a = await makeVariant({ quantity: 1 });
    const pending = await placeOrder(db, jazz([{ variantId: a.id, quantity: 1 }]));

    const [codResult, payResult] = await Promise.allSettled([
      placeOrder(db, cod([{ variantId: a.id, quantity: 1 }])),
      confirmJazzCashPayment(db, { orderNumber: pending.orderNumber, paymentRef: "T1", amountPaid: pending.total.toString() }),
    ]);
    expect(payResult.status).toBe("fulfilled");
    const pay = (payResult as PromiseFulfilledResult<Awaited<ReturnType<typeof confirmJazzCashPayment>>>).value;

    if (codResult.status === "fulfilled") {
      expect(pay.outcome).toBe("REFUND_NEEDED"); // COD was first
    } else {
      expect((codResult.reason as DomainError).code).toBe("OUT_OF_STOCK"); // JazzCash was first
      expect(pay.outcome).toBe("PAID");
    }
    expect(await qty(a.id)).toBe(0);
    expect(await db.stockMovement.count({ where: { reason: "SALE" } })).toBe(1);
  });
});

// ---- JazzCash -----------------------------------------------------------

describe("JazzCash orders", () => {
  it("placing takes no stock (no reservation); payment takes it", async () => {
    const a = await makeVariant({ quantity: 2 });
    const order = await placeOrder(db, jazz([{ variantId: a.id, quantity: 1 }]));
    expect(order).toMatchObject({ status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", stockDeductedAt: null });
    expect(await qty(a.id)).toBe(2);

    const res = await confirmJazzCashPayment(db, { orderNumber: order.orderNumber, paymentRef: "JC123", amountPaid: 2750 });
    expect(res.outcome).toBe("PAID");
    expect(res.order).toMatchObject({ status: "NEW", paymentStatus: "PAID", paymentRef: "JC123" });
    expect(res.order.paidAt).not.toBeNull();
    expect(await qty(a.id)).toBe(1);
  });

  it("can't start paying for something already sold out", async () => {
    const a = await makeVariant({ quantity: 0 });
    await expectDomainError(placeOrder(db, jazz([{ variantId: a.id, quantity: 1 }])), "OUT_OF_STOCK");
  });

  it("sold out while paying → cancelled + REFUND_NEEDED, stock untouched", async () => {
    const a = await makeVariant({ quantity: 1 });
    const pending = await placeOrder(db, jazz([{ variantId: a.id, quantity: 1 }]));
    await placeOrder(db, cod([{ variantId: a.id, quantity: 1 }])); // someone else takes it

    const res = await confirmJazzCashPayment(db, { orderNumber: pending.orderNumber, paymentRef: "JC9", amountPaid: 2750 });
    expect(res.outcome).toBe("REFUND_NEEDED");
    expect(res.order).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUND_NEEDED", paymentRef: "JC9", stockDeductedAt: null });
    expect(res.order.cancelReason).toMatch(/sold out/i);
    expect(await qty(a.id)).toBe(0);

    const refunded = await markRefunded(db, { orderId: pending.id });
    expect(refunded.paymentStatus).toBe("REFUNDED");
    await expectDomainError(markRefunded(db, { orderId: pending.id }), "INVALID_TRANSITION");
  });

  it("a repeated JazzCash notification is only processed once", async () => {
    const a = await makeVariant({ quantity: 5 });
    const order = await placeOrder(db, jazz([{ variantId: a.id, quantity: 2 }]));
    const args = { orderNumber: order.orderNumber, paymentRef: "JC1", amountPaid: order.total.toString() };
    expect((await confirmJazzCashPayment(db, args)).outcome).toBe("PAID");
    expect((await confirmJazzCashPayment(db, args)).outcome).toBe("ALREADY_PROCESSED");
    expect(await qty(a.id)).toBe(3);
    await expectDomainError(confirmJazzCashPayment(db, { ...args, paymentRef: "OTHER" }), "INVALID_TRANSITION");
  });

  it("rejects a payment for the wrong amount and leaves the order unpaid", async () => {
    const a = await makeVariant({ quantity: 5 });
    const order = await placeOrder(db, jazz([{ variantId: a.id, quantity: 1 }]));
    await expectDomainError(
      confirmJazzCashPayment(db, { orderNumber: order.orderNumber, paymentRef: "X", amountPaid: 100 }),
      "AMOUNT_MISMATCH",
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("UNPAID");
    expect(await qty(a.id)).toBe(5);
  });

  it("rejects payment confirmation for COD or unknown orders", async () => {
    const a = await makeVariant({ quantity: 5 });
    const c = await placeOrder(db, cod([{ variantId: a.id, quantity: 1 }]));
    await expectDomainError(confirmJazzCashPayment(db, { orderNumber: c.orderNumber, paymentRef: "X", amountPaid: 2750 }), "INVALID_TRANSITION");
    await expectDomainError(confirmJazzCashPayment(db, { orderNumber: "1", paymentRef: "X", amountPaid: 1 }), "NOT_FOUND");
  });

  it("unpaid for 24h → ABANDONED; a late payment is still accepted if stock allows", async () => {
    const a = await makeVariant({ quantity: 5 });
    const old = await placeOrder(db, jazz([{ variantId: a.id, quantity: 1 }]));
    const fresh = await placeOrder(db, jazz([{ variantId: a.id, quantity: 1 }]));
    await db.order.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 25 * 3600_000) } });

    expect(await abandonUnpaidOrders(db)).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("ABANDONED");
    expect((await db.order.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe("AWAITING_PAYMENT");
    expect(await qty(a.id)).toBe(5);

    const late = await confirmJazzCashPayment(db, { orderNumber: old.orderNumber, paymentRef: "LATE", amountPaid: 2750 });
    expect(late.outcome).toBe("PAID");
    expect(await qty(a.id)).toBe(4);
  });
});

// ---- owner actions ------------------------------------------------------

describe("order status (owner)", () => {
  it("moves forward only; COD becomes PAID on delivery", async () => {
    const a = await makeVariant({ quantity: 5 });
    const o = await placeOrder(db, cod([{ variantId: a.id, quantity: 1 }]));

    expect((await updateOrderStatus(db, { orderId: o.id, status: "PROCESSING" })).status).toBe("PROCESSING");
    await expectDomainError(updateOrderStatus(db, { orderId: o.id, status: "PROCESSING" }), "INVALID_TRANSITION");
    expect((await updateOrderStatus(db, { orderId: o.id, status: "SHIPPED" })).status).toBe("SHIPPED");

    const delivered = await updateOrderStatus(db, { orderId: o.id, status: "DELIVERED" });
    expect(delivered).toMatchObject({ status: "DELIVERED", paymentStatus: "PAID" });
    expect(delivered.paidAt).not.toBeNull();
  });

  it("can skip ahead (New → Shipped) but not ship an unpaid JazzCash order", async () => {
    const a = await makeVariant({ quantity: 5 });
    const o = await placeOrder(db, cod([{ variantId: a.id, quantity: 1 }]));
    expect((await updateOrderStatus(db, { orderId: o.id, status: "SHIPPED" })).status).toBe("SHIPPED");

    const j = await placeOrder(db, jazz([{ variantId: a.id, quantity: 1 }]));
    await expectDomainError(updateOrderStatus(db, { orderId: j.id, status: "PROCESSING" }), "INVALID_TRANSITION");
  });
});

describe("cancelling (owner)", () => {
  it("returns COD stock and logs it", async () => {
    const a = await makeVariant({ quantity: 3 });
    const o = await placeOrder(db, cod([{ variantId: a.id, quantity: 2 }]));
    expect(await qty(a.id)).toBe(1);

    const c = await cancelOrder(db, { orderId: o.id, reason: "Customer asked to cancel" });
    expect(c).toMatchObject({ status: "CANCELLED", cancelReason: "Customer asked to cancel", stockDeductedAt: null, paymentStatus: "UNPAID" });
    expect(await qty(a.id)).toBe(3);
    const back = await db.stockMovement.findFirstOrThrow({ where: { orderId: o.id, reason: "ORDER_CANCELLED" } });
    expect([back.change, back.quantityAfter]).toEqual([2, 3]);
  });

  it("can't cancel twice, can't cancel after shipping, needs a reason", async () => {
    const a = await makeVariant({ quantity: 5 });
    const o = await placeOrder(db, cod([{ variantId: a.id, quantity: 1 }]));
    await expectDomainError(cancelOrder(db, { orderId: o.id, reason: " " }), "INVALID_INPUT");
    await cancelOrder(db, { orderId: o.id, reason: "x" });
    await expectDomainError(cancelOrder(db, { orderId: o.id, reason: "x" }), "INVALID_TRANSITION");
    expect(await qty(a.id)).toBe(5); // returned exactly once

    const s = await placeOrder(db, cod([{ variantId: a.id, quantity: 1 }]));
    await updateOrderStatus(db, { orderId: s.id, status: "SHIPPED" });
    await expectDomainError(cancelOrder(db, { orderId: s.id, reason: "x" }), "INVALID_TRANSITION");
    expect(await qty(a.id)).toBe(4);
  });

  it("cancelling an unpaid JazzCash order returns nothing (nothing was taken)", async () => {
    const a = await makeVariant({ quantity: 5 });
    const j = await placeOrder(db, jazz([{ variantId: a.id, quantity: 2 }]));
    await cancelOrder(db, { orderId: j.id, reason: "Duplicate" });
    expect(await qty(a.id)).toBe(5);
    expect(await db.stockMovement.count()).toBe(0);
  });

  it("cancelling a paid JazzCash order returns stock and flags a refund", async () => {
    const a = await makeVariant({ quantity: 5 });
    const j = await placeOrder(db, jazz([{ variantId: a.id, quantity: 2 }]));
    await confirmJazzCashPayment(db, { orderNumber: j.orderNumber, paymentRef: "P", amountPaid: j.total.toString() });
    expect(await qty(a.id)).toBe(3);

    const c = await cancelOrder(db, { orderId: j.id, reason: "Customer changed mind" });
    expect(c.paymentStatus).toBe("REFUND_NEEDED");
    expect(await qty(a.id)).toBe(5);
  });
});

describe("owner stock edits", () => {
  it("updates the quantity and logs it", async () => {
    const a = await makeVariant({ quantity: 2 });
    await adjustStock(db, { variantId: a.id, expectedQuantity: 2, newQuantity: 10, note: "New shipment" });
    expect(await qty(a.id)).toBe(10);
    const m = await db.stockMovement.findFirstOrThrow({ where: { variantId: a.id } });
    expect(m).toMatchObject({ change: 8, quantityAfter: 10, reason: "ADMIN_ADJUST", note: "New shipment" });
  });

  it("refuses to overwrite a sale that happened while the owner was editing", async () => {
    const a = await makeVariant({ quantity: 2 });
    // Owner opens the edit form and sees 2 … meanwhile a customer buys 1.
    await placeOrder(db, cod([{ variantId: a.id, quantity: 1 }]));
    const err = await expectDomainError(adjustStock(db, { variantId: a.id, expectedQuantity: 2, newQuantity: 5 }), "STOCK_CONFLICT");
    expect(err.details).toEqual({ currentQuantity: 1 });
    expect(await qty(a.id)).toBe(1);
  });

  it("rejects negative or fractional quantities", async () => {
    const a = await makeVariant({ quantity: 2 });
    await expectDomainError(adjustStock(db, { variantId: a.id, expectedQuantity: 2, newQuantity: -1 }), "INVALID_INPUT");
    await expectDomainError(adjustStock(db, { variantId: a.id, expectedQuantity: 2, newQuantity: 1.5 }), "INVALID_INPUT");
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getAdminOrder, listAdminOrders } from "@/server/admin/orders";
import { DomainError } from "@/server/errors";
import { toInternationalPk, whatsappLink } from "@/lib/format";
import {
  abandonUnpaidOrders,
  addOrderNote,
  cancelOrder,
  confirmJazzCashPayment,
  markRefunded,
  placeOrder,
  updateDelivery,
  updateOrderStatus,
} from "@/server/orders/orders";
import { toPublicOrder } from "@/server/orders/public-order";
import { ensureDefaultSettings } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";
import { createDesign } from "./helpers/fixtures";

const OWNER = "owner@test.lunara";
let variantId: number;

const customer = (name = "Ayesha Khan", phone = "0300-1234567") => ({
  name,
  email: `${name.split(" ")[0].toLowerCase()}@example.com`,
  phone,
  address: "House 12, Street 4",
  city: "Lahore",
});
const cod = (name?: string, phone?: string) =>
  placeOrder(db, { items: [{ variantId, quantity: 1 }], customer: customer(name, phone), paymentMethod: "COD" });
const jazz = (name?: string) => placeOrder(db, { items: [{ variantId, quantity: 1 }], customer: customer(name), paymentMethod: "JAZZCASH" });

async function expectError(p: Promise<unknown>, code: string, message?: RegExp) {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (message) expect((e as DomainError).message).toMatch(message);
}
const timeline = async (orderId: number) =>
  (await getAdminOrder(db, orderId))!.events
    .slice()
    .reverse()
    .map((e) => `${e.type} | ${e.actor} | ${e.message ?? ""}`);

beforeEach(async () => {
  await resetDb();
  await ensureDefaultSettings(db);
  variantId = (await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", colour: "Blue", qty: 20, price: 2500 }] })).variants[0].id;
});
afterAll(() => db.$disconnect());

describe("order timeline", () => {
  it("records every step of a COD order, who did it, and delivery details", async () => {
    const o = await cod();
    await updateOrderStatus(db, { orderId: o.id, status: "PROCESSING" }, OWNER);
    await addOrderNote(db, { orderId: o.id, note: "Called customer, address confirmed" }, OWNER);
    await updateOrderStatus(db, { orderId: o.id, status: "SHIPPED", delivery: { method: "COURIER", courier: "TCS", trackingNumber: "CN-778899" } }, OWNER);
    const done = await updateOrderStatus(db, { orderId: o.id, status: "DELIVERED" }, OWNER);

    expect(await timeline(o.id)).toEqual([
      "PLACED | customer | Cash on Delivery",
      `STATUS_CHANGED | ${OWNER} | New → Processing`,
      `NOTE | ${OWNER} | Called customer, address confirmed`,
      `STATUS_CHANGED | ${OWNER} | Processing → Shipped — TCS · tracking CN-778899`,
      `STATUS_CHANGED | ${OWNER} | Shipped → Delivered — cash collected`,
    ]);
    expect(done).toMatchObject({ status: "DELIVERED", paymentStatus: "PAID", deliveryMethod: "COURIER", courier: "TCS", trackingNumber: "CN-778899" });
    expect(done.shippedAt).not.toBeNull();
    expect(done.deliveredAt).not.toBeNull();
  });

  it("JazzCash: paid, sold-out refund, cancellation and refund are all recorded", async () => {
    const paid = await jazz();
    await confirmJazzCashPayment(db, { orderNumber: paid.orderNumber, paymentRef: "JC-1", amountPaid: 2750 });
    await cancelOrder(db, { orderId: paid.id, reason: "Customer changed mind" }, OWNER);
    await markRefunded(db, { orderId: paid.id, note: "Refunded via JazzCash portal, ref R-55" }, OWNER);
    expect(await timeline(paid.id)).toEqual([
      "PLACED | customer | JazzCash — waiting for payment",
      "PAID | JazzCash | Paid 2750 · ref JC-1",
      `CANCELLED | ${OWNER} | Customer changed mind — items returned to stock — refund needed`,
      `REFUNDED | ${OWNER} | Refunded via JazzCash portal, ref R-55`,
    ]);

    await db.variant.update({ where: { id: variantId }, data: { quantity: 0 } });
    const late = await jazz("Sara Ahmed").catch(() => null);
    expect(late).toBeNull(); // can't even start paying when sold out
  });

  it("abandoned JazzCash orders get a timeline entry", async () => {
    const o = await jazz();
    await db.order.update({ where: { id: o.id }, data: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
    expect(await abandonUnpaidOrders(db)).toBe(1);
    expect((await timeline(o.id)).at(-1)).toBe("ABANDONED | system | Not paid within 24 hours");
    expect(await abandonUnpaidOrders(db)).toBe(0); // no duplicates on the next run
  });
});

describe("delivery details", () => {
  it("shipping needs a delivery method; a courier needs a name; tracking is optional", async () => {
    const o = await cod();
    await expectError(updateOrderStatus(db, { orderId: o.id, status: "SHIPPED" }), "INVALID_INPUT", /own delivery or a courier/);
    await expectError(updateOrderStatus(db, { orderId: o.id, status: "SHIPPED", delivery: { method: "COURIER" } }), "INVALID_INPUT", /courier company/);
    const s = await updateOrderStatus(db, { orderId: o.id, status: "SHIPPED", delivery: { method: "COURIER", courier: "Leopards", trackingNumber: "" } });
    expect(s).toMatchObject({ deliveryMethod: "COURIER", courier: "Leopards", trackingNumber: null });
  });

  it("own delivery never stores a courier or tracking number", async () => {
    const o = await cod();
    const s = await updateOrderStatus(db, {
      orderId: o.id,
      status: "SHIPPED",
      delivery: { method: "OWN", courier: "TCS", trackingNumber: "X1", riderInfo: "Ali 0301-5550000" },
    });
    expect(s).toMatchObject({ deliveryMethod: "OWN", courier: null, trackingNumber: null, riderInfo: "Ali 0301-5550000" });
    expect((await timeline(o.id)).at(-1)).toMatch(/Own delivery \(Ali 0301-5550000\)$/);
  });

  it("the tracking number can be added after shipping, but not before", async () => {
    const o = await cod();
    await expectError(updateDelivery(db, { orderId: o.id, delivery: { method: "OWN" } }), "INVALID_TRANSITION");
    await updateOrderStatus(db, { orderId: o.id, status: "SHIPPED", delivery: { method: "COURIER", courier: "TCS" } });
    const u = await updateDelivery(db, { orderId: o.id, delivery: { method: "COURIER", courier: "TCS", trackingNumber: "CN-1" } }, OWNER);
    expect(u.trackingNumber).toBe("CN-1");
    expect((await timeline(o.id)).at(-1)).toBe(`SHIPPING_UPDATED | ${OWNER} | TCS · tracking CN-1`);
  });

  it("the customer-facing order includes delivery details once shipped", async () => {
    const o = await cod();
    expect(toPublicOrder(o).delivery).toBeNull();
    const s = await updateOrderStatus(db, { orderId: o.id, status: "SHIPPED", delivery: { method: "COURIER", courier: "TCS", trackingNumber: "CN-9" } });
    expect(toPublicOrder(s).delivery).toMatchObject({ method: "COURIER", courier: "TCS", trackingNumber: "CN-9" });
  });
});

describe("notes", () => {
  it("rejects empty notes and unknown orders", async () => {
    const o = await cod();
    await expectError(addOrderNote(db, { orderId: o.id, note: "   " }), "INVALID_INPUT");
    await expectError(addOrderNote(db, { orderId: 999999, note: "hi" }), "NOT_FOUND");
  });
});

describe("orders list", () => {
  it("tabs, counts, search and payment filter", async () => {
    const a = await cod("Ayesha Khan", "0300-1234567");
    const b = await cod("Sara Ahmed", "+92 321 7654321");
    const c = await jazz("Hina Malik");
    await updateOrderStatus(db, { orderId: b.id, status: "SHIPPED", delivery: { method: "COURIER", courier: "TCS", trackingNumber: "CN-4242" } });
    await confirmJazzCashPayment(db, { orderNumber: c.orderNumber, paymentRef: "J", amountPaid: 2750 });
    await cancelOrder(db, { orderId: c.id, reason: "Duplicate" }); // → refund needed

    const all = await listAdminOrders(db, { tab: "all" });
    expect(all.counts).toMatchObject({ action: 2, shipped: 1, cancelled: 1, awaiting: 0, all: 3 });
    expect(all.refundsNeeded).toBe(1);
    expect((await listAdminOrders(db, {})).orders.map((o) => o.customerName).sort()).toEqual(["Ayesha Khan", "Hina Malik"]); // default tab: needs action

    const names = async (q: Parameters<typeof listAdminOrders>[1]) => (await listAdminOrders(db, q)).orders.map((o) => o.customerName);
    expect(await names({ tab: "all", q: `#${a.orderNumber}` })).toEqual(["Ayesha Khan"]);
    expect(await names({ tab: "all", q: "sara" })).toEqual(["Sara Ahmed"]);
    expect(await names({ tab: "all", q: "0321-7654321" })).toEqual(["Sara Ahmed"]); // phone typed differently
    expect(await names({ tab: "all", q: "cn-4242" })).toEqual(["Sara Ahmed"]);
    expect(await names({ tab: "all", method: "JAZZCASH" })).toEqual(["Hina Malik"]);
    expect(await names({ tab: "bogus" as never })).toHaveLength(2); // unknown tab → Needs action
  });
});

describe("phone links", () => {
  it("turns Pakistani numbers into WhatsApp links", () => {
    expect(toInternationalPk("0300-1234567")).toBe("923001234567");
    expect(toInternationalPk("+92 300 1234567")).toBe("923001234567");
    expect(toInternationalPk("0092 300 1234567")).toBe("923001234567");
    expect(toInternationalPk("3001234567")).toBe("923001234567");
    expect(toInternationalPk("12345")).toBeNull();
    expect(whatsappLink("0300-1234567", "Order #10001")).toBe("https://wa.me/923001234567?text=Order%20%2310001");
  });
});

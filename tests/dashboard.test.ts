import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDashboard, periodDays } from "@/server/admin/dashboard";
import { cancelOrder, confirmJazzCashPayment, placeOrder } from "@/server/orders/orders";
import { ensureDefaultSettings } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";
import { createDesign } from "./helpers/fixtures";

// "Now" for every test: 2 Oct 2026, noon in Pakistan
const NOW = new Date("2026-10-02T12:00:00+05:00");
const pkt = (s: string) => new Date(`${s}+05:00`);
const customer = { name: "Test Buyer", email: "b@example.com", phone: "03001234567", address: "1 Test Street", city: "Lahore" };

let earring: { id: number }[]; // [Gold Blue (cost 1000), Gold Green (no cost)]
let ring: { id: number }[];

async function order(items: [number, number][], method: "COD" | "JAZZCASH", at: string) {
  const o = await placeOrder(db, { items: items.map(([variantId, quantity]) => ({ variantId, quantity })), customer, paymentMethod: method });
  await db.order.update({ where: { id: o.id }, data: { createdAt: pkt(at) } });
  return o;
}

beforeEach(async () => {
  await resetDb();
  await ensureDefaultSettings(db);
  const e = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", colour: "Blue", qty: 50, price: 2500 }, { finish: "GOLD", colour: "Green", qty: 50, price: 2500 }] });
  await db.variant.update({ where: { id: e.variants[0].id }, data: { costPrice: 1000 } });
  earring = e.variants;
  const r = await createDesign({ name: "Caroline", category: "RINGS", variants: [{ finish: "GOLD", size: "8", qty: 50, price: 4000 }] });
  await db.variant.update({ where: { id: r.variants[0].id }, data: { costPrice: 1500 } });
  ring = r.variants;
});
afterAll(() => db.$disconnect());

describe("period days (Pakistan time)", () => {
  it("lists the last N calendar days ending today", () => {
    const { keys, from } = periodDays(7, NOW);
    expect(keys).toEqual(["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(from.toISOString()).toBe("2026-09-25T19:00:00.000Z"); // 26 Sep 00:00 PKT
  });
});

describe("dashboard numbers", () => {
  beforeEach(async () => {
    await order([[earring[0].id, 2]], "COD", "2026-10-02T00:30:00"); // just after midnight PKT → counts on 2 Oct
    await order([[ring[0].id, 1], [earring[1].id, 1]], "COD", "2026-09-30T15:00:00");
    const paid = await order([[earring[0].id, 1]], "JAZZCASH", "2026-10-01T10:00:00");
    await confirmJazzCashPayment(db, { orderNumber: paid.orderNumber, paymentRef: "J1", amountPaid: 2750 });
    await order([[ring[0].id, 1]], "COD", "2026-09-10T10:00:00"); // 22 days ago → only in the 30-day view

    // NOT sales:
    await order([[earring[0].id, 5]], "JAZZCASH", "2026-10-02T09:00:00"); // unpaid
    const cancelled = await order([[ring[0].id, 3]], "COD", "2026-10-02T08:00:00");
    await cancelOrder(db, { orderId: cancelled.id, reason: "test" });
  });

  it("7 days: counts only real sales, with shipping and profit", async () => {
    const d = await getDashboard(db, { days: 7, now: NOW });
    // sales: 5000 (2× Blue) + 6500 (ring + Green) + 2500 (paid Blue)
    expect(d.totals).toMatchObject({
      orders: 3,
      productSales: 14000,
      shipping: 750,
      revenue: 14750,
      averageOrder: 4916.67,
      pieces: 5,
      piecesWithoutCost: 1, // Green had no cost price
    });
    // profit on items with known cost: Blue 3×(2500−1000)=4500 + ring 4000−1500=2500
    expect(d.totals.grossProfit).toBe(7000);
    expect(d.totals.margin).toBe(60.9); // 7000 / 11500
    expect(d.byMethod).toEqual({ COD: { orders: 2, sales: 11500 }, JAZZCASH: { orders: 1, sales: 2500 } });
  });

  it("daily chart uses Pakistan dates", async () => {
    const d = await getDashboard(db, { days: 7, now: NOW });
    const byDay = Object.fromEntries(d.daily.map((x) => [x.day, x.sales]));
    expect(byDay).toMatchObject({ "2026-09-30": 6500, "2026-10-01": 2500, "2026-10-02": 5000, "2026-09-29": 0 });
    expect(d.daily).toHaveLength(7);
  });

  it("best sellers and categories", async () => {
    const d = await getDashboard(db, { days: 7, now: NOW });
    expect(d.topDesigns.map((t) => [t.name, t.pieces, t.sales])).toEqual([
      ["Aveline", 4, 10000],
      ["Caroline", 1, 4000],
    ]);
    expect(d.byCategory.map((c) => [c.category, c.sales])).toEqual([
      ["EARRINGS", 10000],
      ["RINGS", 4000],
    ]);
  });

  it("30 days includes the older sale; unknown periods fall back to 30", async () => {
    expect((await getDashboard(db, { days: 30, now: NOW })).totals.orders).toBe(4);
    expect((await getDashboard(db, { days: 12345, now: NOW })).days).toBe(30);
  });

  it("profit uses the cost at the time of sale, not today's cost", async () => {
    await db.variant.update({ where: { id: earring[0].id }, data: { costPrice: 2400 } });
    expect((await getDashboard(db, { days: 7, now: NOW })).totals.grossProfit).toBe(7000);
  });

  it("recent orders and alerts", async () => {
    const d = await getDashboard(db, { days: 7, now: NOW });
    expect(d.recent).toHaveLength(5);
    expect(d.alerts).toMatchObject({ newOrders: 4, awaitingPayment: 1, refundsNeeded: 0, outOfStock: 0, lowStock: 0, unpriced: 0, noPhotos: 2, threshold: 3 });
  });
});

describe("alerts", () => {
  it("counts stock problems for visible items only", async () => {
    await db.variant.update({ where: { id: earring[0].id }, data: { quantity: 0 } });
    await db.variant.update({ where: { id: earring[1].id }, data: { quantity: 2 } });
    await createDesign({ name: "Hidden", active: false, variants: [{ finish: "GOLD", qty: 0 }] });
    await createDesign({ name: "Unpriced", variants: [{ finish: "GOLD", qty: 1, price: null }] });
    const a = (await getDashboard(db, { now: NOW })).alerts;
    expect(a).toMatchObject({ outOfStock: 1, lowStock: 2, unpriced: 1 }); // low: Green 2 + Unpriced 1
  });

  it("an empty shop has zeros, not errors", async () => {
    await resetDb();
    const d = await getDashboard(db, { now: NOW });
    expect(d.totals).toMatchObject({ orders: 0, revenue: 0, averageOrder: 0, grossProfit: 0, margin: null });
    expect(d.topDesigns).toEqual([]);
  });
});

import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET as listRoute } from "@/app/api/products/route";
import { GET as productRoute } from "@/app/api/products/[slug]/route";
import { POST as cartRoute } from "@/app/api/cart/validate/route";
import { POST as ordersRoute } from "@/app/api/orders/route";
import { POST as subscribeRoute } from "@/app/api/subscribe/route";
import { GET as settingsRoute } from "@/app/api/store/settings/route";
import { GET as cronRoute } from "@/app/api/cron/abandon-orders/route";
import { ensureDefaultSettings } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";
import { createDesign } from "./helpers/fixtures";

const BASE = "http://localhost:3000";
const get = (path: string, headers?: Record<string, string>) => new NextRequest(`${BASE}${path}`, { headers });
const post = (path: string, body: unknown) =>
  new NextRequest(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const customer = { name: "Sara Ahmed", email: "sara@example.com", phone: "03211234567", address: "12 Mall Road", city: "Lahore" };

beforeEach(async () => {
  await resetDb();
  await ensureDefaultSettings(db);
});
afterAll(() => db.$disconnect());

describe("GET /api/products", () => {
  it("returns the list as JSON", async () => {
    await createDesign({ name: "Caroline", category: "RINGS", variants: [{ finish: "GOLD", size: "8", qty: 2, price: 3500 }] });
    const res = await listRoute(get("/api/products?category=rings&sort=price_asc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((i: { name: string }) => i.name)).toEqual(["Caroline"]);
    expect(body).toMatchObject({ total: 1, page: 1 });
  });

  it("400 for a bad filter", async () => {
    const res = await listRoute(get("/api/products?category=shoes"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_INPUT");
  });
});

describe("GET /api/products/[slug]", () => {
  it("returns the product page data, 404 when unknown", async () => {
    const p = await createDesign({ name: "Madeleine", variants: [{ finish: "GOLD", colour: "Red", qty: 4, price: 5000 }] });
    const ok = await productRoute(get(`/api/products/${p.slug}`), { params: Promise.resolve({ slug: p.slug }) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ name: "Madeleine", inStock: true, priceFrom: 5000 });

    const missing = await productRoute(get("/api/products/nope"), { params: Promise.resolve({ slug: "nope" }) });
    expect(missing.status).toBe(404);
  });

  it("never exposes SKUs, cost prices or exact stock above the low-stock limit", async () => {
    const p = await createDesign({ name: "Madeleine", variants: [{ finish: "GOLD", colour: "Red", qty: 40, price: 5000 }] });
    await db.variant.updateMany({ data: { costPrice: 1234 } });
    const text = await (await productRoute(get(`/api/products/${p.slug}`), { params: Promise.resolve({ slug: p.slug }) })).text();
    expect(text).not.toMatch(/EAR-\d{3}/);
    expect(text).not.toMatch(/1234|costPrice|"quantity"|40/);
  });
});

describe("POST /api/cart/validate", () => {
  it("refreshes a cart; 400 on broken JSON", async () => {
    const p = await createDesign({ name: "Stud", variants: [{ finish: "GOLD", qty: 1, price: 2000 }] });
    const res = await cartRoute(post("/api/cart/validate", { items: [{ variantId: p.variants[0].id, quantity: 2 }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ subtotal: 2000, shippingFee: 250, total: 2250, hasProblems: true });

    expect((await cartRoute(post("/api/cart/validate", "{not json"))).status).toBe(400);
  });
});

describe("POST /api/orders", () => {
  it("places a COD order: 201, public data only, stock taken", async () => {
    const p = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", colour: "Blue", qty: 3, price: 2500 }] });
    const res = await ordersRoute(post("/api/orders", { items: [{ variantId: p.variants[0].id, quantity: 2 }], customer, paymentMethod: "COD" }));
    expect(res.status).toBe(201);
    const order = await res.json();
    expect(order).toMatchObject({
      status: "NEW",
      paymentMethod: "COD",
      subtotal: 5000,
      shippingFee: 250,
      total: 5250,
      items: [{ name: "Aveline", label: "Aveline — Gold, Blue", quantity: 2, unitPrice: 2500, lineTotal: 5000 }],
    });
    expect(order.orderNumber).toMatch(/^\d{5,}$/);
    expect(JSON.stringify(order)).not.toMatch(/"id"|variantId|stockDeductedAt|EAR-\d{3}/);
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).quantity).toBe(1);
  });

  it("JazzCash order: 201 AWAITING_PAYMENT, no stock taken", async () => {
    const p = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", qty: 3 }] });
    const res = await ordersRoute(post("/api/orders", { items: [{ variantId: p.variants[0].id, quantity: 1 }], customer, paymentMethod: "JAZZCASH" }));
    expect(res.status).toBe(201);
    expect((await res.json()).status).toBe("AWAITING_PAYMENT");
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).quantity).toBe(3);
  });

  it("409 with a clear message when sold out; 400 for bad details", async () => {
    const p = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", colour: "Blue", qty: 0 }] });
    const sold = await ordersRoute(post("/api/orders", { items: [{ variantId: p.variants[0].id, quantity: 1 }], customer, paymentMethod: "COD" }));
    expect(sold.status).toBe(409);
    expect((await sold.json()).error).toMatchObject({ code: "OUT_OF_STOCK", message: "Aveline — Gold, Blue is sold out" });

    const bad = await ordersRoute(post("/api/orders", { items: [], customer, paymentMethod: "COD" }));
    expect(bad.status).toBe(400);
    const badMethod = await ordersRoute(post("/api/orders", { items: [{ variantId: 1, quantity: 1 }], customer, paymentMethod: "BITCOIN" }));
    expect(badMethod.status).toBe(400);
  });
});

describe("other endpoints", () => {
  it("POST /api/subscribe", async () => {
    expect((await subscribeRoute(post("/api/subscribe", { email: "fan@example.com" }))).status).toBe(200);
    expect((await subscribeRoute(post("/api/subscribe", { email: "fan@example.com" }))).status).toBe(200);
    expect((await subscribeRoute(post("/api/subscribe", { email: "bad" }))).status).toBe(400);
    expect(await db.subscriber.count()).toBe(1);
  });

  it("GET /api/store/settings", async () => {
    expect(await (await settingsRoute()).json()).toEqual({ currency: "PKR", shippingFee: 250, paymentMethods: ["COD", "JAZZCASH"] });
  });

  it("GET /api/cron/abandon-orders needs the secret", async () => {
    expect((await cronRoute(get("/api/cron/abandon-orders"))).status).toBe(401);
    expect((await cronRoute(get("/api/cron/abandon-orders", { authorization: "Bearer wrong" }))).status).toBe(401);
    const ok = await cronRoute(get("/api/cron/abandon-orders", { authorization: `Bearer ${process.env.CRON_SECRET}` }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ abandoned: 0 });
  });
});

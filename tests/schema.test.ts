import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb as db } from "./helpers/db";

async function makeProduct(category: "EARRINGS" | "RINGS" = "EARRINGS", articleNo = 1) {
  return db.product.create({
    data: { category, articleNo, name: "Aveline pearl drop", slug: `p-${category}-${articleNo}` },
  });
}

function orderData() {
  return {
    customerName: "Test Customer",
    email: "test@example.com",
    phone: "03001234567",
    address: "House 1, Street 2",
    city: "Lahore",
    paymentMethod: "COD" as const,
    status: "NEW" as const,
    subtotal: 2500,
    shippingFee: 250,
    total: 2750,
  };
}

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("Variant uniqueness", () => {
  it("rejects a duplicate non-ring stock row (same design + finish + colour)", async () => {
    const p = await makeProduct();
    await db.variant.create({ data: { productId: p.id, finish: "GOLD", colour: "Blue", sku: "EAR-001-GD" } });
    await expect(
      db.variant.create({ data: { productId: p.id, finish: "GOLD", colour: "Blue", sku: "EAR-001-GD" } }),
    ).rejects.toThrow(/Unique constraint/i);
  });

  it("allows same finish with a different colour (shared SKU)", async () => {
    const p = await makeProduct();
    await db.variant.create({ data: { productId: p.id, finish: "GOLD", colour: "Blue", sku: "EAR-001-GD" } });
    await db.variant.create({ data: { productId: p.id, finish: "GOLD", colour: "Green", sku: "EAR-001-GD" } });
    expect(await db.variant.count({ where: { sku: "EAR-001-GD" } })).toBe(2);
  });

  it("allows the same ring in different sizes but not the same size twice", async () => {
    const p = await makeProduct("RINGS", 2);
    const base = { productId: p.id, finish: "GOLD" as const, sku: "RNG-002-GD" };
    await db.variant.create({ data: { ...base, size: "7" } });
    await db.variant.create({ data: { ...base, size: "8" } });
    await expect(db.variant.create({ data: { ...base, size: "8" } })).rejects.toThrow(/Unique constraint/i);
  });

  it("defaults colour to 'None / Single' and size to empty", async () => {
    const p = await makeProduct();
    const v = await db.variant.create({ data: { productId: p.id, finish: "SILVER", sku: "EAR-001-SL" } });
    expect(v.colour).toBe("None / Single");
    expect(v.size).toBe("");
    expect(v.isActive).toBe(true);
    expect(v.sellingPrice).toBeNull();
  });
});

describe("Product uniqueness", () => {
  it("article numbers are unique per category, not globally", async () => {
    await makeProduct("EARRINGS", 1);
    await makeProduct("RINGS", 1); // Rings 001 is a different design from Earrings 001
    await expect(
      db.product.create({ data: { category: "EARRINGS", articleNo: 1, name: "Dup", slug: "dup" } }),
    ).rejects.toThrow(/Unique constraint/i);
  });
});

describe("Database safety checks", () => {
  it("never allows negative stock", async () => {
    const p = await makeProduct();
    const v = await db.variant.create({ data: { productId: p.id, finish: "GOLD", sku: "EAR-001-GD", quantity: 1 } });
    await expect(db.variant.update({ where: { id: v.id }, data: { quantity: { decrement: 2 } } })).rejects.toThrow(
      /Variant_quantity_nonnegative/,
    );
    expect((await db.variant.findUniqueOrThrow({ where: { id: v.id } })).quantity).toBe(1);
  });

  it("rejects negative prices", async () => {
    const p = await makeProduct();
    await expect(
      db.variant.create({ data: { productId: p.id, finish: "GOLD", sku: "EAR-001-GD", sellingPrice: -1 } }),
    ).rejects.toThrow(/Variant_prices_nonnegative/);
  });

  it("rejects an order item with quantity 0", async () => {
    const p = await makeProduct();
    const v = await db.variant.create({ data: { productId: p.id, finish: "GOLD", sku: "EAR-001-GD" } });
    const o = await db.order.create({ data: orderData() });
    await expect(
      db.orderItem.create({
        data: {
          orderId: o.id, variantId: v.id, quantity: 0, priceAtSale: 2500,
          productName: p.name, sku: v.sku, finish: v.finish, colour: v.colour, size: v.size,
        },
      }),
    ).rejects.toThrow(/OrderItem_quantity_positive/);
  });

  it("blocks deleting a variant that has been sold (history is protected)", async () => {
    const p = await makeProduct();
    const v = await db.variant.create({ data: { productId: p.id, finish: "GOLD", sku: "EAR-001-GD" } });
    const o = await db.order.create({ data: orderData() });
    await db.orderItem.create({
      data: {
        orderId: o.id, variantId: v.id, quantity: 1, priceAtSale: 2500,
        productName: p.name, sku: v.sku, finish: v.finish, colour: v.colour, size: v.size,
      },
    });
    await expect(db.variant.delete({ where: { id: v.id } })).rejects.toThrow();
  });
});

describe("Order numbers", () => {
  it("are generated automatically, unique and increasing", async () => {
    const a = await db.order.create({ data: orderData() });
    const b = await db.order.create({ data: orderData() });
    expect(Number(a.orderNumber)).toBeGreaterThanOrEqual(10001);
    expect(Number(b.orderNumber)).toBe(Number(a.orderNumber) + 1);
  });
});

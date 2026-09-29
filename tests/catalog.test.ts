import { ZodError } from "zod";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getProductDetail, listProducts, validateCart } from "@/server/catalog/catalog";
import { DomainError } from "@/server/errors";
import { subscribe } from "@/server/marketing/subscribers";
import { ensureDefaultSettings } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";
import { createDesign } from "./helpers/fixtures";

beforeEach(async () => {
  await resetDb();
  await ensureDefaultSettings(db);
});
afterAll(() => db.$disconnect());

const detail = async (slug: string) => (await getProductDetail(db, slug))!;

// ---- product page options ---------------------------------------------

describe("product page options (Finish → Colour → Size)", () => {
  it("the workbook's example: Gold has Blue/Green/Pink, Silver only Blue", async () => {
    const p = await createDesign({
      name: "Pearl Drop",
      variants: [
        { finish: "GOLD", colour: "Blue", qty: 2 },
        { finish: "GOLD", colour: "Green", qty: 1 },
        { finish: "GOLD", colour: "Pink", qty: 5 },
        { finish: "SILVER", colour: "Blue", qty: 3 },
        { finish: "SILVER", colour: "Pink", qty: 0 }, // sold out → not offered
      ],
    });
    const d = await detail(p.slug);

    expect(d.showFinishSelector).toBe(true);
    expect(d.finishes.map((f) => f.finish)).toEqual(["GOLD", "SILVER"]);

    const gold = d.finishes[0];
    expect(gold.showColourSelector).toBe(true);
    expect(gold.colours.map((c) => c.colour)).toEqual(["Pink", "Green", "Blue"]); // workbook colour order

    const silver = d.finishes[1];
    expect(silver.showColourSelector).toBe(false); // only Blue left → no colour selector
    expect(silver.colours.map((c) => c.colour)).toEqual(["Blue"]);

    const stock = (f: number, c: string) => d.finishes[f].colours.find((x) => x.colour === c)!.variants[0].stock;
    expect(stock(0, "Blue")).toEqual({ status: "LOW_STOCK", left: 2 });
    expect(stock(0, "Green")).toEqual({ status: "LOW_STOCK", left: 1 });
    expect(stock(0, "Pink")).toEqual({ status: "IN_STOCK" });
    expect(stock(1, "Blue")).toEqual({ status: "LOW_STOCK", left: 3 });
  });

  it("one finish, no colour: no selectors at all", async () => {
    const p = await createDesign({ name: "Crystal Stud", variants: [{ finish: "GOLD", qty: 5 }] });
    const d = await detail(p.slug);
    expect(d.showFinishSelector).toBe(false);
    expect(d.finishes[0].showColourSelector).toBe(false);
    expect(d.finishes[0].colours[0]).toMatchObject({ colour: "None / Single", showSizeSelector: false });
    expect(d.finishes[0].colours[0].variants).toEqual([
      { variantId: p.variants[0].id, size: "", price: 2500, stock: { status: "IN_STOCK" } },
    ]);
  });

  it("rings: sizes offered per colour, sorted, Adjustable last, sold-out sizes hidden", async () => {
    const p = await createDesign({
      name: "Flower Bloom",
      category: "RINGS",
      variants: [
        { finish: "GOLD", colour: "Blue", size: "Adjustable", qty: 1 },
        { finish: "GOLD", colour: "Blue", size: "8", qty: 3 },
        { finish: "GOLD", colour: "Blue", size: "7", qty: 2 },
        { finish: "GOLD", colour: "Blue", size: "9", qty: 0 },
      ],
    });
    const c = (await detail(p.slug)).finishes[0].colours[0];
    expect(c.showSizeSelector).toBe(true);
    expect(c.variants.map((v) => v.size)).toEqual(["7", "8", "Adjustable"]);
  });

  it("unpriced or owner-hidden stock rows are invisible", async () => {
    const p = await createDesign({
      name: "Mixed",
      variants: [
        { finish: "GOLD", qty: 5 },
        { finish: "SILVER", qty: 5, price: null }, // not priced yet
        { finish: "SILVER", colour: "Blue", qty: 5, active: false }, // owner marked sold out
      ],
    });
    const d = await detail(p.slug);
    expect(d.finishes.map((f) => f.finish)).toEqual(["GOLD"]);
    expect(d.showFinishSelector).toBe(false);

    const unpriced = await createDesign({ name: "Not Priced Yet", variants: [{ finish: "GOLD", qty: 5, price: null }] });
    expect(await getProductDetail(db, unpriced.slug)).toBeNull();
    const hidden = await createDesign({ name: "Hidden Design", active: false, variants: [{ finish: "GOLD", qty: 5 }] });
    expect(await getProductDetail(db, hidden.slug)).toBeNull();
    expect(await getProductDetail(db, "does-not-exist")).toBeNull();
  });

  it("everything sold out: the design still shows, as Out of Stock, with no options", async () => {
    const p = await createDesign({
      name: "Lumina Arc",
      variants: [{ finish: "GOLD", qty: 0, price: 12000 }],
      images: [{ url: "/img/lumina.jpg" }],
    });
    const d = await detail(p.slug);
    expect(d).toMatchObject({ inStock: false, finishes: [], showFinishSelector: false, priceFrom: 12000 });
    expect(d.images.map((i) => i.url)).toEqual(["/img/lumina.jpg"]);
  });

  it("photos follow the chosen finish + colour, falling back to finish, then general photos", async () => {
    const p = await createDesign({
      name: "Aveline",
      variants: [
        { finish: "GOLD", colour: "Blue", qty: 1 },
        { finish: "GOLD", colour: "Green", qty: 1 },
        { finish: "SILVER", colour: "Blue", qty: 1 },
      ],
      images: [
        { finish: "GOLD", colour: "Blue", url: "/gold-blue-1.jpg" },
        { finish: "GOLD", colour: "Blue", url: "/gold-blue-2.jpg" },
        { finish: "SILVER", url: "/silver.jpg" },
        { url: "/general.jpg" },
      ],
    });
    const d = await detail(p.slug);
    const imgs = (f: number, c: string) => d.finishes[f].colours.find((x) => x.colour === c)!.images.map((i) => i.url);
    expect(imgs(0, "Blue")).toEqual(["/gold-blue-1.jpg", "/gold-blue-2.jpg"]);
    expect(imgs(0, "Green")).toEqual(["/general.jpg"]);
    expect(imgs(1, "Blue")).toEqual(["/silver.jpg"]);
    expect(d.finishes[0].colours.find((c) => c.colour === "Blue")!.images[0].alt).toBe("Aveline — Gold — Blue");
    expect(d.finishes[0].colours.find((c) => c.colour === "Green")!.images[0].alt).toBe("Aveline");
  });

  it("uses the owner's low-stock setting", async () => {
    await db.setting.update({ where: { key: "low_stock_threshold" }, data: { value: "5" } });
    const p = await createDesign({ name: "Stud", variants: [{ finish: "GOLD", qty: 5 }] });
    expect((await detail(p.slug)).finishes[0].colours[0].variants[0].stock).toEqual({ status: "LOW_STOCK", left: 5 });
  });
});

// ---- product list -------------------------------------------------------

describe("product list", () => {
  beforeEach(async () => {
    const day = (n: number) => new Date(Date.UTC(2026, 8, n));
    await createDesign({ name: "Aveline Pearl Drop", description: "Freshwater pearl", createdAt: day(1), variants: [{ finish: "GOLD", colour: "Blue", qty: 2, price: 2500 }, { finish: "SILVER", colour: "Green", qty: 1, price: 2200 }] });
    await createDesign({ name: "Madeleine", createdAt: day(3), isNewArrival: true, variants: [{ finish: "GOLD", colour: "Red", qty: 4, price: 5000 }] });
    await createDesign({ name: "Caroline", category: "RINGS", createdAt: day(2), variants: [{ finish: "GOLD", size: "8", qty: 2, price: 3500 }] });
    await createDesign({ name: "Sold Out Studs", createdAt: day(4), variants: [{ finish: "SILVER", qty: 0, price: 1500 }] });
    await createDesign({ name: "Unpriced", createdAt: day(5), variants: [{ finish: "GOLD", qty: 9, price: null }] });
  });
  const names = async (q: Parameters<typeof listProducts>[1]) => (await listProducts(db, q)).items.map((i) => i.name);

  it("lists priced designs newest first, sold-out ones last, unpriced never", async () => {
    expect(await names({})).toEqual(["Madeleine", "Caroline", "Aveline Pearl Drop", "Sold Out Studs"]);
    const soldOut = (await listProducts(db, {})).items.at(-1)!;
    expect(soldOut.inStock).toBe(false);
  });

  it("filters by category (by URL name), search, finish, colour, stock and New Arrivals", async () => {
    expect(await names({ category: "rings" })).toEqual(["Caroline"]);
    expect(await names({ category: "earrings", inStock: "true" })).toEqual(["Madeleine", "Aveline Pearl Drop"]);
    expect(await names({ q: "PEARL" })).toEqual(["Aveline Pearl Drop"]); // name or description, any case
    expect(await names({ finish: "silver" })).toEqual(["Aveline Pearl Drop", "Sold Out Studs"]);
    expect(await names({ colour: "green" })).toEqual(["Aveline Pearl Drop"]);
    expect(await names({ newArrivals: "true" })).toEqual(["Madeleine"]);
  });

  it("filters by price and sorts by price or name", async () => {
    expect(await names({ minPrice: "3000" })).toEqual(["Madeleine", "Caroline"]);
    expect(await names({ maxPrice: "2400" })).toEqual(["Aveline Pearl Drop", "Sold Out Studs"]);
    expect(await names({ sort: "price_asc" })).toEqual(["Aveline Pearl Drop", "Caroline", "Madeleine", "Sold Out Studs"]);
    expect(await names({ sort: "price_desc" })).toEqual(["Madeleine", "Caroline", "Aveline Pearl Drop", "Sold Out Studs"]);
    expect(await names({ sort: "name" })).toEqual(["Aveline Pearl Drop", "Caroline", "Madeleine", "Sold Out Studs"]);
  });

  it("gives a card with price range, finishes and colours (never 'None / Single')", async () => {
    const card = (await listProducts(db, { q: "aveline" })).items[0];
    expect(card).toMatchObject({ priceFrom: 2200, priceTo: 2500, finishes: ["GOLD", "SILVER"], colours: ["Green", "Blue"], inStock: true });
    expect((await listProducts(db, { q: "caroline" })).items[0].colours).toEqual([]);
  });

  it("pages results", async () => {
    const p1 = await listProducts(db, { pageSize: "2", page: "1" });
    const p2 = await listProducts(db, { pageSize: "2", page: "2" });
    expect([p1.total, p1.totalPages]).toEqual([4, 2]);
    expect([...p1.items, ...p2.items].map((i) => i.name)).toEqual(["Madeleine", "Caroline", "Aveline Pearl Drop", "Sold Out Studs"]);
  });

  it("rejects an unknown category", async () => {
    await expect(listProducts(db, { category: "shoes" })).rejects.toBeInstanceOf(ZodError);
  });
});

// ---- cart ---------------------------------------------------------------

describe("cart check", () => {
  it("returns current prices, 'Only N left' and totals with shipping", async () => {
    const p = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", colour: "Blue", qty: 2, price: 2500 }] });
    const cart = await validateCart(db, { items: [{ variantId: p.variants[0].id, quantity: 2, price: 2500 }] });
    expect(cart.lines[0]).toMatchObject({
      label: "Aveline — Gold, Blue",
      quantity: 2,
      unitPrice: 2500,
      lineTotal: 5000,
      stock: { status: "LOW_STOCK", left: 2 },
      problem: null,
      priceChanged: false,
    });
    expect([cart.subtotal, cart.shippingFee, cart.total, cart.hasProblems]).toEqual([5000, 250, 5250, false]);
  });

  it("flags sold-out, reduced, unavailable and re-priced lines", async () => {
    const p = await createDesign({
      name: "Mixed",
      variants: [
        { finish: "GOLD", colour: "Blue", qty: 0 },
        { finish: "GOLD", colour: "Green", qty: 1 },
        { finish: "GOLD", colour: "Red", qty: 5, price: null },
        { finish: "SILVER", qty: 5, price: 3000 },
      ],
    });
    const [soldOut, low, unpriced, repriced] = p.variants.map((v) => v.id);
    const cart = await validateCart(db, {
      items: [
        { variantId: soldOut, quantity: 1 },
        { variantId: low, quantity: 3 },
        { variantId: unpriced, quantity: 1 },
        { variantId: repriced, quantity: 1, price: 2500 },
        { variantId: 999999, quantity: 1 },
      ],
    });
    expect(cart.lines.map((l) => [l.problem, l.quantity, l.priceChanged])).toEqual([
      ["OUT_OF_STOCK", 0, false],
      ["QUANTITY_REDUCED", 1, false],
      ["UNAVAILABLE", 0, false],
      [null, 1, true],
      ["UNAVAILABLE", 0, false],
    ]);
    expect(cart.hasProblems).toBe(true);
    expect(cart.subtotal).toBe(2500 + 3000);
  });

  it("an empty cart has no shipping charge", async () => {
    expect(await validateCart(db, { items: [] })).toMatchObject({ subtotal: 0, shippingFee: 0, total: 0 });
  });
});

// ---- mailing list -------------------------------------------------------

describe("mailing list", () => {
  it("signs up once, ignores repeats, rejects bad emails", async () => {
    await subscribe(db, " Fan@Example.com ");
    await subscribe(db, "fan@example.com");
    expect(await db.subscriber.findMany({ select: { email: true } })).toEqual([{ email: "fan@example.com" }]);
    await expect(subscribe(db, "nope")).rejects.toBeInstanceOf(DomainError);
  });
});

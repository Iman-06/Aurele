import { z } from "zod";
import type { Category, Finish, Prisma, PrismaClient } from "@/generated/prisma/client";
import { COLOURS, FINISH_LABELS, NO_COLOUR, RING_SIZES } from "../inventory/catalog-rules";
import { stockStatus, variantLabel, type StockStatus } from "../inventory/stock";
import { getNumberSetting } from "../settings";

// ------------------------------------------------------------
// What customers can see. Rules (from the inventory workbook + BRD):
//  • A variant is SELLABLE when it is active, priced, and its design is active.
//  • A design is LISTED when it has at least one sellable variant. If all of those are
//    at 0 stock it is still listed, marked Out of Stock.
//  • Product page: Finish first → Colour only if that finish has >1 colour → Size for rings.
//    Combinations with 0 stock ARE shown (greyed, "Sold out") but can't be bought.
//  • 1–3 left → "Only N left". The SKU is never shown to customers.
// The catalogue is small (hundreds of designs), so filtering/sorting happens in memory
// on one query — simple and always consistent.
// ------------------------------------------------------------

const sellableVariant = { isActive: true, sellingPrice: { not: null } } satisfies Prisma.VariantWhereInput;

const productInclude = {
  variants: { where: sellableVariant, orderBy: { id: "asc" } },
  images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
} satisfies Prisma.ProductInclude;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type VariantRow = ProductRow["variants"][number];
type ImageRow = ProductRow["images"][number];

export type Image = { url: string; alt: string };
const money = (d: { toString(): string }) => Number(d.toString());
const colourOrder = (c: string) => {
  const i = (COLOURS as readonly string[]).indexOf(c);
  return i === -1 ? 999 : i;
};
const sizeOrder = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 1000 + (RING_SIZES as readonly string[]).indexOf(s);
};
const finishOrder = (f: Finish) => (f === "GOLD" ? 0 : 1);

function toImage(img: ImageRow, productName: string): Image {
  const bits = [productName, img.finish && FINISH_LABELS[img.finish], img.colour !== NO_COLOUR ? img.colour : null];
  return { url: img.url, alt: img.alt ?? bits.filter(Boolean).join(" — ") };
}

/** Photos for a finish+colour: exact match → same finish → general design photos → anything. */
function imagesFor(p: { name: string; images: ImageRow[] }, finish: Finish | null, colour: string | null): Image[] {
  const pick = (f: (i: ImageRow) => boolean) => p.images.filter(f).map((i) => toImage(i, p.name));
  const tiers = [
    finish && colour ? pick((i) => i.finish === finish && i.colour === colour) : [],
    finish ? pick((i) => i.finish === finish && !i.colour) : [],
    pick((i) => !i.finish && !i.colour),
    pick(() => true),
  ];
  return tiers.find((t) => t.length) ?? [];
}

const CATEGORY_SLUGS: Record<string, Category> = {
  earrings: "EARRINGS",
  rings: "RINGS",
  bracelets: "BRACELETS",
  necklace: "NECKLACE",
  necklaces: "NECKLACE",
};

// ------------------------------------------------------------
// Product list (shop / category / search pages)
// ------------------------------------------------------------

const bool = z.preprocess((v) => v === true || v === "true" || v === "1", z.boolean());
const optionalNumber = z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional());

export const listProductsQuery = z.object({
  category: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const c = CATEGORY_SLUGS[v.toLowerCase()] ?? (Object.values(CATEGORY_SLUGS).includes(v as Category) ? (v as Category) : undefined);
      if (!c) ctx.addIssue({ code: "custom", message: `Unknown category "${v}"` });
      return c;
    }),
  q: z.string().trim().max(100).optional(),
  finish: z
    .string()
    .optional()
    .transform((v) => (v ? (v.toUpperCase() === "GOLD" ? "GOLD" : v.toUpperCase() === "SILVER" ? "SILVER" : undefined) : undefined)),
  colour: z.string().trim().optional(),
  minPrice: optionalNumber,
  maxPrice: optionalNumber,
  inStock: bool.optional(),
  newArrivals: bool.optional(),
  oneOfAKind: bool.optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});
export type ListProductsQuery = z.input<typeof listProductsQuery>;

export type ProductCard = {
  id: number;
  slug: string;
  name: string;
  category: Category;
  isNewArrival: boolean;
  isOneOfAKind: boolean;
  priceFrom: number;
  priceTo: number;
  finishes: Finish[];
  colours: string[]; // real colours only (no "None / Single")
  inStock: boolean;
  // true → the product has more than one finish / colour / size, so the card shows "Choose"
  // (sold-out options count too — the product page shows them greyed out);
  // false → a single option, so the card can add it straight to the cart ("Add").
  // Counts priced, switched-on options; ignores the list filters.
  hasMultipleOptions: boolean;
  image: Image | null;
};

export type ProductList = { items: ProductCard[]; total: number; page: number; pageSize: number; totalPages: number };

export async function listProducts(db: PrismaClient, query: ListProductsQuery = {}): Promise<ProductList> {
  const q = listProductsQuery.parse(query);

  const products = await db.product.findMany({
    where: {
      isActive: true,
      variants: { some: sellableVariant },
      ...(q.category ? { category: q.category } : {}),
      ...(q.newArrivals ? { isNewArrival: true } : {}),
      ...(q.oneOfAKind ? { isOneOfAKind: true } : {}),
      ...(q.q
        ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { description: { contains: q.q, mode: "insensitive" } }] }
        : {}),
    },
    include: productInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const cards: ProductCard[] = []; // already newest-first from the query
  for (const p of products) {
    // Only the variants matching the finish/colour filters count for price and stock.
    const matching = p.variants.filter(
      (v) => (!q.finish || v.finish === q.finish) && (!q.colour || v.colour.toLowerCase() === q.colour.toLowerCase()),
    );
    if (!matching.length) continue;
    const available = matching.filter((v) => v.quantity > 0);
    if (q.inStock && !available.length) continue;

    // Price range from what can be bought now (or everything, if sold out)
    const priced = (available.length ? available : matching).map((v) => money(v.sellingPrice!));
    const priceFrom = Math.min(...priced);
    const priceTo = Math.max(...priced);
    if (q.minPrice !== undefined && priceTo < q.minPrice) continue;
    if (q.maxPrice !== undefined && priceFrom > q.maxPrice) continue;

    const first = available[0] ?? matching[0];
    cards.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      isNewArrival: p.isNewArrival,
      isOneOfAKind: p.isOneOfAKind,
      priceFrom,
      priceTo,
      finishes: [...new Set(p.variants.map((v) => v.finish))].sort((a, b) => finishOrder(a) - finishOrder(b)),
      colours: [...new Set(p.variants.map((v) => v.colour).filter((c) => c !== NO_COLOUR))].sort((a, b) => colourOrder(a) - colourOrder(b)),
      inStock: available.length > 0,
      hasMultipleOptions: p.variants.length > 1,
      image: imagesFor(p, first.finish, first.colour)[0] ?? null,
    });
  }

  // Array.sort is stable, so "newest" keeps the query order.
  const sorters: Record<typeof q.sort, (a: ProductCard, b: ProductCard) => number> = {
    newest: () => 0,
    price_asc: (a, b) => a.priceFrom - b.priceFrom || a.name.localeCompare(b.name),
    price_desc: (a, b) => b.priceFrom - a.priceFrom || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  // Sold-out designs always go after available ones
  cards.sort((a, b) => Number(b.inStock) - Number(a.inStock) || sorters[q.sort](a, b));

  const start = (q.page - 1) * q.pageSize;
  return {
    items: cards.slice(start, start + q.pageSize),
    total: cards.length,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(cards.length / q.pageSize)),
  };
}

// ------------------------------------------------------------
// Product page — option tree for the Finish → Colour → Size selectors
// ------------------------------------------------------------

export type VariantOption = {
  variantId: number;
  size: string; // "" for non-rings
  price: number;
  stock: StockStatus; // OUT_OF_STOCK → show greyed out with "Sold out", not selectable
};

export type ColourOption = {
  colour: string; // "None / Single" when the design has no colour choice
  inStock: boolean; // false → every size of this colour is sold out (show greyed)
  images: Image[];
  showSizeSelector: boolean; // rings
  variants: VariantOption[]; // one per size (exactly one for non-rings)
};

export type FinishOption = {
  finish: Finish;
  label: string;
  inStock: boolean; // false → every colour/size of this finish is sold out (show greyed)
  showColourSelector: boolean; // only if this finish has more than one colour (sold-out ones included)
  colours: ColourOption[];
};

export type ProductDetail = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  category: Category;
  isNewArrival: boolean;
  isOneOfAKind: boolean;
  priceFrom: number;
  priceTo: number;
  inStock: boolean; // false → show "Out of Stock", no Add to Cart
  showFinishSelector: boolean; // only if the design has more than one finish (sold-out ones included)
  finishes: FinishOption[]; // every priced option, sold-out ones marked OUT_OF_STOCK
  defaultVariantId: number | null; // select this one first: the first in-stock option (null = all sold out)
  images: Image[]; // default gallery (for defaultVariantId, or the first option when all sold out)
};

export async function getProductDetail(db: PrismaClient, slug: string): Promise<ProductDetail | null> {
  const p = await db.product.findFirst({ where: { slug, isActive: true }, include: productInclude });
  if (!p || !p.variants.length) return null;

  const threshold = await getNumberSetting(db, "low_stock_threshold");
  const available = p.variants.filter((v) => v.quantity > 0);

  const byFinish = new Map<Finish, Map<string, VariantRow[]>>();
  for (const v of p.variants) {
    const colours = byFinish.get(v.finish) ?? new Map<string, VariantRow[]>();
    colours.set(v.colour, [...(colours.get(v.colour) ?? []), v]);
    byFinish.set(v.finish, colours);
  }

  const finishes: FinishOption[] = [...byFinish.entries()]
    .sort(([a], [b]) => finishOrder(a) - finishOrder(b))
    .map(([finish, colours]) => ({
      finish,
      label: FINISH_LABELS[finish],
      inStock: [...colours.values()].some((vs) => vs.some((v) => v.quantity > 0)),
      showColourSelector: colours.size > 1,
      colours: [...colours.entries()]
        .sort(([a], [b]) => colourOrder(a) - colourOrder(b))
        .map(([colour, vs]) => ({
          colour,
          inStock: vs.some((v) => v.quantity > 0),
          images: imagesFor(p, finish, colour),
          showSizeSelector: p.category === "RINGS",
          variants: vs
            .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size))
            .map((v) => ({
              variantId: v.id,
              size: v.size,
              price: money(v.sellingPrice!),
              stock: stockStatus(v.quantity, threshold),
            })),
        })),
    }));

  const prices = (available.length ? available : p.variants).map((v) => money(v.sellingPrice!));
  // First in-stock option in the order the selectors show them (finish → colour → size)
  const ordered = finishes.flatMap((f) => f.colours.flatMap((c) => c.variants.map((v) => ({ f, c, v }))));
  const firstAvailable = ordered.find((o) => o.v.stock.status !== "OUT_OF_STOCK");
  const first = firstAvailable ?? ordered[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category,
    isNewArrival: p.isNewArrival,
    isOneOfAKind: p.isOneOfAKind,
    priceFrom: Math.min(...prices),
    priceTo: Math.max(...prices),
    inStock: available.length > 0,
    showFinishSelector: finishes.length > 1,
    finishes,
    defaultVariantId: firstAvailable?.v.variantId ?? null,
    images: imagesFor(p, first.f.finish, first.c.colour),
  };
}

// ------------------------------------------------------------
// Cart check — the cart lives in the customer's browser, so refresh it from the database
// ------------------------------------------------------------

export const validateCartInput = z.object({
  items: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
        price: z.number().nonnegative().optional(), // price the customer last saw, to detect changes
      }),
    )
    .max(50),
});
export type ValidateCartInput = z.input<typeof validateCartInput>;

export type CartLine = {
  variantId: number;
  slug: string | null;
  name: string;
  label: string; // "Aveline Pearl Drop — Gold, Blue"
  finish: Finish | null;
  colour: string | null;
  size: string | null;
  image: Image | null;
  requestedQuantity: number;
  quantity: number; // what can actually be bought (0 if unavailable)
  unitPrice: number | null;
  lineTotal: number;
  stock: StockStatus;
  problem: null | "UNAVAILABLE" | "OUT_OF_STOCK" | "QUANTITY_REDUCED";
  priceChanged: boolean;
};

export type CartSummary = {
  lines: CartLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
  hasProblems: boolean; // true → show the messages and ask the customer to review before checkout
};

export async function validateCart(db: PrismaClient, input: ValidateCartInput): Promise<CartSummary> {
  const { items } = validateCartInput.parse(input);
  const variants = await db.variant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: { product: { include: { images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const threshold = await getNumberSetting(db, "low_stock_threshold");
  const shipping = await getNumberSetting(db, "shipping_fee");

  const lines: CartLine[] = items.map((item) => {
    const v = byId.get(item.variantId);
    const sellable = v && v.isActive && v.product.isActive && v.sellingPrice !== null;
    if (!v || !sellable) {
      // Never reveal what a hidden/unpriced item is — it may be an unreleased design.
      return {
        variantId: item.variantId,
        slug: null,
        name: "Item no longer available",
        label: "Item no longer available",
        finish: null,
        colour: null,
        size: null,
        image: null,
        requestedQuantity: item.quantity,
        quantity: 0,
        unitPrice: null,
        lineTotal: 0,
        stock: { status: "OUT_OF_STOCK" },
        problem: "UNAVAILABLE",
        priceChanged: false,
      };
    }
    const unitPrice = money(v.sellingPrice!);
    const quantity = Math.min(item.quantity, v.quantity);
    return {
      variantId: v.id,
      slug: v.product.slug,
      name: v.product.name,
      label: variantLabel({ ...v, productName: v.product.name }),
      finish: v.finish,
      colour: v.colour,
      size: v.size,
      image: imagesFor(v.product, v.finish, v.colour)[0] ?? null,
      requestedQuantity: item.quantity,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      stock: stockStatus(v.quantity, threshold),
      problem: v.quantity === 0 ? "OUT_OF_STOCK" : quantity < item.quantity ? "QUANTITY_REDUCED" : null,
      priceChanged: item.price !== undefined && item.price !== unitPrice,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const shippingFee = subtotal > 0 ? shipping : 0;
  return {
    lines,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    hasProblems: lines.some((l) => l.problem !== null || l.priceChanged),
  };
}

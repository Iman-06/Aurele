import { z } from "zod";
import { Prisma, type Category, type Finish, type PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import {
  COLOURS,
  NO_COLOUR,
  RING_SIZES,
  capitaliseName,
  generateSku,
  generateSlug,
  normaliseRingSize,
} from "../inventory/catalog-rules";
import { removeImage, saveImage } from "../media/storage";

// Admin product management (designs, stock rows, prices, photos).
// Callers (Server Actions) must check requireAdmin() first. Inputs are raw form fields
// (strings, "on" for ticked checkboxes) and are validated by the zod schemas below.

const CATEGORIES = ["EARRINGS", "RINGS", "BRACELETS", "NECKLACE"] as const;
const FINISHES = ["GOLD", "SILVER"] as const;

/** "2,800" / "Rs 2800" / "2800.00" → 2800; "" → null. */
const priceField = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).replace(/rs\.?/i, "").replace(/[,\s]/g, "");
    return s === "" ? null : Number(s);
  },
  z.number({ error: "Price must be a number" }).nonnegative("Price can't be negative").max(10_000_000).nullable(),
);
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new DomainError("INVALID_INPUT", r.error.issues[0]?.message ?? "Invalid input", r.error.issues);
  return r.data;
}

async function soldCount(db: PrismaClient | Prisma.TransactionClient, where: Prisma.OrderItemWhereInput) {
  return db.orderItem.count({ where });
}

// ------------------------------------------------------------
// Designs
// ------------------------------------------------------------

export const productListFilter = z.object({
  q: z.string().trim().optional(),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  status: z.enum(["all", "visible", "hidden", "unpriced", "new"]).default("all").catch("all"),
});

export type AdminProductRow = {
  id: number;
  category: Category;
  articleNo: number;
  name: string;
  slug: string;
  isActive: boolean;
  isNewArrival: boolean;
  variantCount: number;
  totalStock: number;
  unpricedCount: number;
  imageCount: number;
  thumbnail: string | null;
};

export async function listAdminProducts(db: PrismaClient, filter: z.input<typeof productListFilter> = {}): Promise<AdminProductRow[]> {
  const f = productListFilter.parse(filter);
  const products = await db.product.findMany({
    where: {
      ...(f.category ? { category: f.category } : {}),
      ...(f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: "insensitive" } },
              { variants: { some: { sku: { contains: f.q, mode: "insensitive" } } } },
              ...(/^\d+$/.test(f.q) ? [{ articleNo: Number(f.q) }] : []),
            ],
          }
        : {}),
      ...(f.status === "visible" ? { isActive: true } : {}),
      ...(f.status === "hidden" ? { isActive: false } : {}),
      ...(f.status === "new" ? { isNewArrival: true } : {}),
      ...(f.status === "unpriced" ? { variants: { some: { sellingPrice: null } } } : {}),
    },
    include: {
      variants: { select: { quantity: true, sellingPrice: true } },
      images: { select: { url: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
    orderBy: [{ category: "asc" }, { articleNo: "asc" }],
  });
  return products.map((p) => ({
    id: p.id,
    category: p.category,
    articleNo: p.articleNo,
    name: p.name,
    slug: p.slug,
    isActive: p.isActive,
    isNewArrival: p.isNewArrival,
    variantCount: p.variants.length,
    totalStock: p.variants.reduce((s, v) => s + v.quantity, 0),
    unpricedCount: p.variants.filter((v) => v.sellingPrice === null).length,
    imageCount: p.images.length,
    thumbnail: p.images[0]?.url ?? null,
  }));
}

export async function nextArticleNo(db: PrismaClient, category: Category) {
  const max = await db.product.aggregate({ where: { category }, _max: { articleNo: true } });
  return (max._max.articleNo ?? 0) + 1;
}

const productFields = {
  name: z.string().trim().min(2, "Please enter a product name").max(120).transform(capitaliseName),
  description: z.string().trim().max(5000).optional().transform((v) => v || null),
  isNewArrival: checkbox,
  isActive: checkbox,
};

export const createProductInput = z.object({
  category: z.enum(CATEGORIES, { error: "Please choose a category" }),
  articleNo: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().positive("Article No. must be a whole number above 0").optional()),
  ...productFields,
});

export async function createProduct(db: PrismaClient, input: Record<string, unknown>) {
  const d = parse(createProductInput, input);
  const articleNo = d.articleNo ?? (await nextArticleNo(db, d.category));
  const taken = await db.product.findUnique({ where: { category_articleNo: { category: d.category, articleNo } } });
  if (taken) {
    throw new DomainError("INVALID_INPUT", `Article No. ${String(articleNo).padStart(3, "0")} is already used by "${taken.name}" in this category`);
  }
  return db.product.create({
    data: {
      category: d.category,
      articleNo,
      name: d.name,
      slug: generateSlug(d.name, d.category, articleNo),
      description: d.description,
      isNewArrival: d.isNewArrival,
      isActive: d.isActive,
    },
  });
}

export const updateProductInput = z.object(productFields);

/** Category and article number are fixed (they're printed on the SKU labels); the URL stays the same. */
export async function updateProduct(db: PrismaClient, productId: number, input: Record<string, unknown>) {
  const d = parse(updateProductInput, input);
  return db.product.update({ where: { id: productId }, data: d }).catch((e) => {
    throw notFoundOr(e, "Product not found");
  });
}

export async function setProductFlags(db: PrismaClient, productId: number, flags: { isActive?: boolean; isNewArrival?: boolean }) {
  return db.product.update({ where: { id: productId }, data: flags }).catch((e) => {
    throw notFoundOr(e, "Product not found");
  });
}

/** Only designs that were never sold can be deleted — otherwise hide them. */
export async function deleteProduct(db: PrismaClient, productId: number) {
  const sold = await soldCount(db, { variant: { productId } });
  if (sold) throw new DomainError("INVALID_TRANSITION", "This design has been sold before, so it can't be deleted (order history needs it). Hide it instead.");
  const images = await db.productImage.findMany({ where: { productId }, select: { url: true } });
  await db.product.delete({ where: { id: productId } }).catch((e) => {
    throw notFoundOr(e, "Product not found");
  });
  await Promise.all(images.map((i) => removeImage(i.url)));
}

// ------------------------------------------------------------
// Stock rows (variants)
// ------------------------------------------------------------

const colourField = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return NO_COLOUR;
    const c = COLOURS.find((x) => x.toLowerCase() === v.toLowerCase());
    if (!c) ctx.addIssue({ code: "custom", message: `"${v}" is not in the colour list` });
    return c ?? NO_COLOUR;
  });

export const addVariantInput = z.object({
  finish: z.enum(FINISHES, { error: "Please choose Gold or Silver" }),
  colour: colourField,
  size: z.string().optional(),
  quantity: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int("Quantity must be a whole number").min(0, "Quantity can't be negative").max(100_000)),
  sellingPrice: priceField.optional(),
  costPrice: priceField.optional(),
});

export async function addVariant(db: PrismaClient, productId: number, input: Record<string, unknown>) {
  const d = parse(addVariantInput, input);
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new DomainError("NOT_FOUND", "Product not found");

  let size = "";
  if (product.category === "RINGS") {
    size = normaliseRingSize(d.size);
    if (!(RING_SIZES as readonly string[]).includes(size)) {
      throw new DomainError("INVALID_INPUT", `Please choose a ring size (${RING_SIZES.join(", ")})`);
    }
  }

  // Same price for every colour of a finish: a new colour/size inherits its finish's price.
  let sellingPrice = d.sellingPrice ?? null;
  let costPrice = d.costPrice ?? null;
  if (sellingPrice === null || costPrice === null) {
    const sibling = await db.variant.findFirst({ where: { productId, finish: d.finish }, orderBy: { id: "asc" } });
    sellingPrice ??= sibling?.sellingPrice ? Number(sibling.sellingPrice) : null;
    costPrice ??= sibling?.costPrice ? Number(sibling.costPrice) : null;
  }

  try {
    return await db.$transaction(async (tx) => {
      const v = await tx.variant.create({
        data: {
          productId,
          finish: d.finish,
          colour: d.colour,
          size,
          sku: generateSku(product.category, product.articleNo, d.finish),
          quantity: d.quantity,
          sellingPrice,
          costPrice,
        },
      });
      if (d.quantity > 0) {
        await tx.stockMovement.create({
          data: { variantId: v.id, change: d.quantity, quantityAfter: d.quantity, reason: "ADMIN_ADJUST", note: "Added in admin" },
        });
      }
      return v;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new DomainError("INVALID_INPUT", "This finish/colour/size already exists for this design — edit that row instead");
    }
    throw e;
  }
}

export const updateVariantInput = z.object({
  sellingPrice: priceField,
  costPrice: priceField,
  isActive: checkbox,
});

/** Prices and the sold-out switch. Quantity changes go through adjustStock() (conflict-safe). */
export async function updateVariant(db: PrismaClient, variantId: number, input: Record<string, unknown>) {
  const d = parse(updateVariantInput, input);
  return db.variant.update({ where: { id: variantId }, data: d }).catch((e) => {
    throw notFoundOr(e, "Stock row not found");
  });
}

export const finishPriceInput = z.object({
  finish: z.enum(FINISHES),
  sellingPrice: priceField,
  costPrice: priceField.optional(),
});

/** Set one price for every colour/size of a finish (e.g. all Gold Aveline = Rs 2,800). */
export async function setFinishPrice(db: PrismaClient, productId: number, input: Record<string, unknown>) {
  const d = parse(finishPriceInput, input);
  if (d.sellingPrice === null) throw new DomainError("INVALID_INPUT", "Please enter a selling price");
  const res = await db.variant.updateMany({
    where: { productId, finish: d.finish },
    data: { sellingPrice: d.sellingPrice, ...(d.costPrice !== undefined && d.costPrice !== null ? { costPrice: d.costPrice } : {}) },
  });
  if (res.count === 0) throw new DomainError("NOT_FOUND", "This design has no stock rows in that finish yet");
  return res.count;
}

/** Only rows that were never sold can be deleted — otherwise switch them to hidden. */
export async function deleteVariant(db: PrismaClient, variantId: number) {
  if (await soldCount(db, { variantId })) {
    throw new DomainError("INVALID_TRANSITION", "This item has been sold before, so it can't be deleted. Mark it hidden / sold out instead.");
  }
  await db.variant.delete({ where: { id: variantId } }).catch((e) => {
    throw notFoundOr(e, "Stock row not found");
  });
}

// ------------------------------------------------------------
// Photos
// ------------------------------------------------------------

export const addImageInput = z.object({
  finish: z.enum(FINISHES).optional().or(z.literal("").transform(() => undefined)),
  colour: z.string().trim().optional().transform((v) => (v && v !== NO_COLOUR ? v : undefined)),
  alt: z.string().trim().max(200).optional().transform((v) => v || null),
});

/** Photo for a finish + colour (or a general photo for the design when both are empty). */
export async function addImage(db: PrismaClient, productId: number, file: File, input: Record<string, unknown>) {
  const d = parse(addImageInput, input);
  if (d.colour && !d.finish) throw new DomainError("INVALID_INPUT", "Choose a finish for a colour photo");
  if (d.colour && !COLOURS.includes(d.colour as (typeof COLOURS)[number])) {
    throw new DomainError("INVALID_INPUT", `"${d.colour}" is not in the colour list`);
  }
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new DomainError("NOT_FOUND", "Product not found");

  const url = await saveImage(file); // validates type + size
  const last = await db.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } });
  return db.productImage.create({
    data: {
      productId,
      finish: d.finish ?? null,
      colour: d.colour ?? null,
      url,
      alt: d.alt,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
}

export async function deleteImage(db: PrismaClient, imageId: number) {
  const img = await db.productImage.delete({ where: { id: imageId } }).catch((e) => {
    throw notFoundOr(e, "Photo not found");
  });
  await removeImage(img.url);
}

/** Move a photo one place earlier/later among the design's photos. */
export async function moveImage(db: PrismaClient, imageId: number, direction: "up" | "down") {
  const img = await db.productImage.findUnique({ where: { id: imageId } });
  if (!img) throw new DomainError("NOT_FOUND", "Photo not found");
  const all = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const i = all.findIndex((x) => x.id === imageId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((x, n) => db.productImage.update({ where: { id: x.id }, data: { sortOrder: n } })));
}

// ------------------------------------------------------------

export async function getAdminProduct(db: PrismaClient, productId: number) {
  return db.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        orderBy: [{ finish: "asc" }, { id: "asc" }],
        include: { _count: { select: { orderItems: true } } },
      },
      images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });
}
export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

function notFoundOr(e: unknown, message: string) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return new DomainError("NOT_FOUND", message);
  return e;
}

export type { Finish };

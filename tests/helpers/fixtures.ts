import type { Category, Finish } from "@/generated/prisma/client";
import { generateSku, generateSlug } from "@/server/inventory/catalog-rules";
import { testDb as db } from "./db";

type VariantSpec = { finish: Finish; colour?: string; size?: string; qty: number; price?: number | null; active?: boolean };
type ImageSpec = { finish?: Finish; colour?: string; url: string };

let nextArticle = 1;

/** Create a design with its stock rows (and optional photos) in the test database. */
export async function createDesign(spec: {
  name: string;
  category?: Category;
  description?: string;
  variants: VariantSpec[];
  images?: ImageSpec[];
  isNewArrival?: boolean;
  active?: boolean;
  createdAt?: Date;
}) {
  const category = spec.category ?? "EARRINGS";
  const articleNo = nextArticle++;
  return db.product.create({
    data: {
      category,
      articleNo,
      name: spec.name,
      slug: generateSlug(spec.name, category, articleNo),
      description: spec.description,
      isNewArrival: spec.isNewArrival ?? false,
      isActive: spec.active ?? true,
      createdAt: spec.createdAt,
      variants: {
        create: spec.variants.map((v) => ({
          finish: v.finish,
          colour: v.colour ?? "None / Single",
          size: v.size ?? "",
          sku: generateSku(category, articleNo, v.finish),
          quantity: v.qty,
          sellingPrice: v.price === undefined ? 2500 : v.price,
          isActive: v.active ?? true,
        })),
      },
      images: { create: (spec.images ?? []).map((i, n) => ({ ...i, sortOrder: n })) },
    },
    include: { variants: { orderBy: { id: "asc" } } },
  });
}

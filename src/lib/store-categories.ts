import type { ProductCard } from "@/server/catalog/catalog";
import { formatRs } from "@/lib/format";

/** Category pages the header and homepage link to. `query` is what GET /api/products accepts. */
export const STORE_CATEGORIES = [
  { slug: "earrings", label: "Earrings", query: "earrings" },
  { slug: "rings", label: "Rings", query: "rings" },
  { slug: "bracelets", label: "Bracelets", query: "bracelets" },
  { slug: "necklaces", label: "Necklace", query: "necklaces" },
] as const;

/** Header “Shop by Categories” menu. Bracelets stay on /bracelets and in the Store grid. */
export const HEADER_CATEGORIES = [STORE_CATEGORIES[0], STORE_CATEGORIES[1], STORE_CATEGORIES[3]] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

const BY_SLUG = new Map<string, StoreCategory>([
  ...STORE_CATEGORIES.map((c) => [c.slug, c] as const),
  ["necklace", STORE_CATEGORIES[3]],
]);

export function categoryBySlug(slug: string): StoreCategory | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

/**
 * "Choose" when the customer still has a finish or colour decision.
 * A single finish and a single colour (or none) is "Add".
 * Ring sizes are not on the list response — see the product page if a later
 * detail fetch turns up more than one variant.
 */
export function needsChoice(card: Pick<ProductCard, "finishes" | "colours">): boolean {
  return card.finishes.length > 1 || card.colours.length > 1;
}

export function priceRange(from: number, to: number): string {
  return from === to ? formatRs(from) : `${formatRs(from)} – ${formatRs(to)}`;
}

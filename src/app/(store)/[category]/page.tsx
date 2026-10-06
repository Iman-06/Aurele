import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryFilters, type CategoryFilterState } from "@/components/store/category-filters";
import { ProductGrid } from "@/components/store/product-grid";
import { db } from "@/lib/db";
import { categoryBySlug } from "@/lib/store-categories";
import { listProducts } from "@/server/catalog/catalog";

function finishQuery(value: string | undefined): CategoryFilterState["finish"] {
  const v = value?.toLowerCase();
  return v === "gold" || v === "silver" ? v : undefined;
}

function sortQuery(value: string | undefined): CategoryFilterState["sort"] {
  return value === "price_asc" || value === "price_desc" ? value : "newest";
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const known = categoryBySlug(category);
  if (!known) return { title: "Aurele" };
  return {
    title: `${known.label} — Aurele`,
    description: `${known.label} from Aurele. Fine jewelry, made to be worn every day.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ finish?: string; colour?: string; sort?: string }>;
}) {
  const { category } = await params;
  const known = categoryBySlug(category);
  if (!known) notFound();

  const query = await searchParams;
  const current: CategoryFilterState = {
    finish: finishQuery(query.finish),
    colour: query.colour?.trim() || undefined,
    sort: sortQuery(query.sort),
  };
  const shared = { category: known.query, finish: current.finish, sort: current.sort, pageSize: 48 as const };
  const catalog = await listProducts(db, shared);
  const colours = [...new Set(catalog.items.flatMap((item) => item.colours))].sort((a, b) => a.localeCompare(b));
  const filtered = current.colour ? await listProducts(db, { ...shared, colour: current.colour }) : catalog;
  const filtering = Boolean(current.finish || current.colour || current.sort !== "newest");

  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <h1 className="text-sm tracking-[0.42em] uppercase">{known.label}</h1>
      <div className="mt-6 mb-12 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {filtered.total} {filtered.total === 1 ? "piece" : "pieces"}
        </p>
        <CategoryFilters slug={known.slug} colours={colours} isRings={known.slug === "rings"} current={current} />
      </div>
      {filtered.total === 0 && filtering ? (
        <p className="text-sm text-muted">No pieces match these filters.</p>
      ) : (
        <ProductGrid products={filtered.items} />
      )}
    </section>
  );
}

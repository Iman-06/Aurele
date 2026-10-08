import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductGrid } from "@/components/store/product-grid";
import { SearchForm } from "@/components/store/search-form";
import { db } from "@/lib/db";
import { listProducts } from "@/server/catalog/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const query = (await searchParams).q?.trim() ?? "";
  return {
    title: query ? `Search “${query}” — Aurelé` : "Search — Aurelé",
    description: query ? `Pieces matching “${query}” at Aurelé. Aurele.` : "Search Aurelé by name. Aurele.",
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = ((await searchParams).q ?? "").trim().slice(0, 100);

  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <h1 className="font-display text-3xl font-normal tracking-[0.04em] uppercase">Search</h1>
      <Suspense fallback={null}>
        <SearchForm className="mt-8 w-full max-w-md" />
      </Suspense>
      {!query ? (
        <p className="mt-10 text-sm text-muted">Search for a piece by name.</p>
      ) : (
        <Results query={query} />
      )}
    </section>
  );
}

async function Results({ query }: { query: string }) {
  const { items, total } = await listProducts(db, { q: query, pageSize: 48 });

  return (
    <>
      <p className="mt-8 mb-12 text-sm text-muted">
        {total === 0 ? `No pieces match “${query}”.` : `${total} ${total === 1 ? "piece" : "pieces"} for “${query}”`}
      </p>
      {total > 0 && <ProductGrid products={items} />}
    </>
  );
}

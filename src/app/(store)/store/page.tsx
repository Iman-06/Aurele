import type { Metadata } from "next";
import { ProductGrid } from "@/components/store/product-grid";
import { db } from "@/lib/db";
import { listProducts } from "@/server/catalog/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store — Aurelé",
  description: "Shop earrings, rings, bracelets, and necklaces from Aurelé. Aurele.",
};

export default async function StorePage() {
  const { items, total } = await listProducts(db, { sort: "newest", pageSize: 48 });

  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <h1 className="font-display text-3xl font-normal tracking-[0.04em] uppercase">Store</h1>
      <p className="mt-3 mb-12 text-sm text-muted">
        {total} {total === 1 ? "piece" : "pieces"}
      </p>
      <ProductGrid products={items} />
    </section>
  );
}

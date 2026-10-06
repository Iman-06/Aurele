import type { Metadata } from "next";
import { ProductGrid } from "@/components/store/product-grid";
import { db } from "@/lib/db";
import { listProducts } from "@/server/catalog/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Arrivals — Aurele",
  description: "The most recently added pieces at Aurele.",
};

export default async function NewArrivalsPage() {
  const { items, total } = await listProducts(db, { sort: "newest", pageSize: 48 });

  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <h1 className="text-sm tracking-[0.42em] uppercase">New Arrivals</h1>
      <p className="mt-3 mb-12 text-sm text-muted">
        {total} {total === 1 ? "piece" : "pieces"}
      </p>
      <ProductGrid products={items} />
    </section>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPurchase } from "@/components/store/product-purchase";
import { db } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/format";
import { getProductDetail } from "@/server/catalog/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(db, slug);
  if (!product) return { title: "Aurelé" };
  const category = CATEGORY_LABELS[product.category];
  return {
    title: `${product.name} — Aurelé`,
    description: `${product.description?.trim() || `${product.name}, ${category.toLowerCase()} by Aurelé.`} Aurele.`,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductDetail(db, slug);
  if (!product) notFound();

  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <ProductPurchase product={product} />
    </section>
  );
}

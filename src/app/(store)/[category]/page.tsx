import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/store/product-grid";
import { db } from "@/lib/db";
import { categoryBySlug } from "@/lib/store-categories";
import { listProducts } from "@/server/catalog/catalog";

const FINISHES = [
  { value: "", label: "All" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
] as const;

function finishQuery(value: string | undefined): "gold" | "silver" | undefined {
  const v = value?.toLowerCase();
  return v === "gold" || v === "silver" ? v : undefined;
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
  searchParams: Promise<{ finish?: string }>;
}) {
  const { category } = await params;
  const known = categoryBySlug(category);
  if (!known) notFound();

  const finish = finishQuery((await searchParams).finish);
  const { items, total } = await listProducts(db, { category: known.query, finish, pageSize: 48 });

  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <h1 className="text-sm tracking-[0.42em] uppercase">{known.label}</h1>
      <p className="mt-3 text-sm text-muted">
        {total} {total === 1 ? "piece" : "pieces"}
      </p>
      <div className="mt-8 mb-12 flex flex-wrap gap-x-6 gap-y-3 text-[0.7rem] tracking-[0.18em] uppercase">
        {FINISHES.map((option) => {
          const selected = (finish ?? "") === option.value;
          const href = option.value ? `/${known.slug}?finish=${option.value}` : `/${known.slug}`;
          return (
            <Link key={option.label} href={href} className={selected ? "text-foreground" : "text-muted hover:text-foreground"} aria-current={selected ? "true" : undefined}>
              {option.label}
            </Link>
          );
        })}
      </div>
      {total === 0 && finish ? (
        <p className="text-sm text-muted">No {finish} pieces in {known.label.toLowerCase()} right now.</p>
      ) : (
        <ProductGrid products={items} />
      )}
    </section>
  );
}

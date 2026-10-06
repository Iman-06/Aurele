import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/store/product-grid";
import { db } from "@/lib/db";
import { STORE_CATEGORIES } from "@/lib/store-categories";
import { listProducts } from "@/server/catalog/catalog";
import { getHomeContent } from "@/server/content/homepage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aurele — Fine jewelry",
  description: "Quiet pieces, made to be worn every day. Shop earrings, rings, bracelets, and necklaces from Aurele in Lahore.",
};

export default async function HomePage() {
  const [home, arrivals] = await Promise.all([getHomeContent(db), listProducts(db, { sort: "newest", pageSize: 8 })]);
  const { banner, promotion } = home;

  return (
    <div>
      {promotion && (
        <div className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-6 gap-y-2 px-8 py-4 sm:px-12">
            {promotion.url ? (
              <Link href={promotion.url} className="text-[0.7rem] tracking-[0.18em] uppercase hover:text-gold">
                {promotion.title}
              </Link>
            ) : (
              <p className="text-[0.7rem] tracking-[0.18em] uppercase">{promotion.title}</p>
            )}
            {promotion.details && <p className="text-sm text-muted">{promotion.details}</p>}
            {promotion.link && (
              <Link href={promotion.link.url} className="text-[0.7rem] tracking-[0.18em] text-gold uppercase">
                {promotion.link.text}
              </Link>
            )}
          </div>
        </div>
      )}

      {banner && (
        <section className="relative">
          <div className="relative min-h-[70vh] bg-surface">
            <Image
              src={banner.mobileImageUrl}
              alt={banner.heading ?? "Aurele"}
              fill
              priority
              sizes="100vw"
              className="object-cover sm:hidden"
            />
            <Image
              src={banner.imageUrl}
              alt={banner.heading ?? "Aurele"}
              fill
              priority
              sizes="100vw"
              className="hidden object-cover sm:block"
            />
            <div className="relative flex min-h-[70vh] flex-col items-start justify-end gap-4 px-8 py-16 sm:px-12">
              {banner.heading && <h1 className="text-sm tracking-[0.42em] uppercase">{banner.heading}</h1>}
              {banner.subheading && <p className="max-w-md text-sm text-muted">{banner.subheading}</p>}
              {banner.button && (
                <Link href={banner.button.link} className="btn btn-add mt-2">
                  {banner.button.text}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
        <div className="mb-12 flex items-baseline justify-between gap-6">
          <h2 className="text-[0.7rem] tracking-[0.22em] text-muted uppercase">New Arrivals</h2>
          <Link href="/new-arrivals" className="text-[0.7rem] tracking-[0.18em] uppercase hover:text-gold">
            View all
          </Link>
        </div>
        <ProductGrid products={arrivals.items} />
      </section>

      <section className="mx-auto w-full max-w-6xl px-8 pb-20 sm:px-12">
        <h2 className="mb-12 text-[0.7rem] tracking-[0.22em] text-muted uppercase">Shop by Category</h2>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STORE_CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/${category.slug}`}
                className="flex aspect-[4/5] items-end border border-line bg-surface p-6 text-[0.7rem] tracking-[0.18em] uppercase transition-colors hover:border-gold hover:text-gold"
              >
                {category.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

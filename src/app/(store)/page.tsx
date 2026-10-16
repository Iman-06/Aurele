import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/store/brand-mark";
import { HomeHero } from "@/components/store/home-hero";
import { JustInCarousel } from "@/components/store/just-in-carousel";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { OneOfAKindFeature } from "@/components/store/one-of-a-kind-feature";
import { db } from "@/lib/db";
import { ELEGANCE_TILES } from "@/lib/curated-tiles";
import { publicImage } from "@/lib/public-image";
import { listProducts } from "@/server/catalog/catalog";
import { getHomeContent } from "@/server/content/homepage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aurelé — Fine jewelry",
  description: "Quiet pieces, made to be worn every day. Shop earrings, rings, bracelets, and necklaces from Aurelé in Lahore. Aurele.",
};

export default async function HomePage() {
  const [home, arrivals, oneOfAKind] = await Promise.all([
    getHomeContent(db),
    listProducts(db, { sort: "newest", pageSize: 12 }),
    listProducts(db, { oneOfAKind: true, pageSize: 2 }),
  ]);
  const { banner, promotion } = home;
  const tiles = ELEGANCE_TILES.map((tile) => ({ ...tile, src: publicImage(tile.image) }));

  return (
    <div>
      {promotion && (
        <div className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-center gap-x-6 gap-y-2 px-8 py-3 text-center sm:px-12">
            {promotion.url ? (
              <Link href={promotion.url} className="text-[0.7rem] tracking-[0.18em] uppercase hover:opacity-60">
                {promotion.title}
              </Link>
            ) : (
              <p className="text-[0.7rem] tracking-[0.18em] uppercase">{promotion.title}</p>
            )}
            {promotion.details && <p className="text-sm text-muted">{promotion.details}</p>}
            {promotion.link && (
              <Link href={promotion.link.url} className="text-[0.7rem] tracking-[0.18em] uppercase hover:opacity-60">
                {promotion.link.text}
              </Link>
            )}
          </div>
        </div>
      )}

      {banner && (
        <HomeHero
          imageUrl={banner.imageUrl}
          mobileImageUrl={banner.mobileImageUrl}
          heading={banner.heading}
          subheading={banner.subheading}
          button={banner.button}
        />
      )}

      <section className="py-16 sm:py-20">
        <h2 className="text-center font-display text-3xl font-normal tracking-[0.06em] uppercase">Just In</h2>
        <div className="mt-10">
          <JustInCarousel products={arrivals.items} />
        </div>
        <div className="mt-8 text-center">
          <Link href="/new-arrivals" className="text-sm tracking-[0.14em] uppercase hover:opacity-60">
            View all
          </Link>
        </div>
      </section>

      <OneOfAKindFeature products={oneOfAKind.items} />

      <section aria-label="Shop by category" className="py-16 sm:py-20">
        <ul className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-8 pb-2 sm:px-12">
          {tiles.map((tile) => (
            <li key={tile.href} className="w-[78vw] max-w-[20rem] shrink-0 snap-start">
              <Link href={tile.href} aria-label={`Shop ${tile.title}`} className="relative block aspect-[3/4] overflow-hidden bg-[#2a2a2a]">
                {tile.src && <Image src={tile.src} alt="" fill sizes="20rem" className="object-cover" />}
              </Link>
              <div className="mt-5 flex items-center justify-between gap-4">
                <p className="text-sm">{tile.title}</p>
                <Link href={tile.href} className="btn btn-choose">
                  Discover
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative bg-[#1c1c1c] bg-cover bg-center text-white" style={{ backgroundImage: "url(/newsletter-bg.jpg)" }}>
        <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[28rem] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
          <Wordmark variant="light" crop="lockup" className="mb-8 h-40" />
          <h2 className="font-display text-3xl font-normal tracking-[0.06em] uppercase">Newsletter</h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/90">
            Be the first to hear about new pieces, private previews, and care notes for the jewelry you wear every day.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </div>
  );
}

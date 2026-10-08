import Image from "next/image";
import Link from "next/link";
import { CURATED_TILES } from "@/lib/curated-tiles";
import { publicImage } from "@/lib/public-image";
import { listProductsQuery } from "@/server/catalog/catalog";

export function CuratedTiles() {
  const tiles = CURATED_TILES.filter((tile) => !tile.requiresFilter || tile.requiresFilter in listProductsQuery.shape).map((tile) => ({
    ...tile,
    src: publicImage(tile.image),
  }));
  if (tiles.length === 0) return null;

  return (
    <section aria-label="Collections" className={tiles.length > 1 ? "grid md:grid-cols-2" : undefined}>
      {tiles.map((tile, index) => (
        <Link key={tile.id} href={tile.href} className="group relative flex min-h-[28rem] items-center justify-center overflow-hidden bg-[#2a2a2a] md:min-h-[36rem]">
          {tile.src && (
            <Image
              src={tile.src}
              alt=""
              fill
              priority={index === 0}
              sizes={tiles.length > 1 ? "(min-width: 768px) 50vw, 100vw" : "100vw"}
              className="object-cover"
            />
          )}
          <span className="absolute inset-0 bg-black/45" aria-hidden="true" />
          <span className="relative z-10 flex flex-col items-center px-6 text-center text-white">
            <span className="text-[11px] tracking-[0.22em] uppercase">{tile.label}</span>
            <span className="mt-3 font-display text-4xl font-normal sm:text-6xl">{tile.title}</span>
            <span className="mt-8 border border-white px-8 py-3 text-[11px] tracking-[0.18em] uppercase transition-colors group-hover:bg-white group-hover:text-black">
              Discover
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}

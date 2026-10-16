import Image from "next/image";
import Link from "next/link";
import { ONE_OF_A_KIND_BLURB, ONE_OF_A_KIND_HEADING } from "@/lib/storefront";
import type { ProductCard } from "@/server/catalog/catalog";
import { ProductPlaceholder } from "./product-placeholder";

export function OneOfAKindFeature({ products }: { products: ProductCard[] }) {
  if (products.length === 0) return null;
  const photos = products.slice(0, 2);

  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-8 py-20 sm:px-12 lg:grid-cols-2 lg:gap-20">
      {photos.length === 1 ? (
        <PhotoFrame product={photos[0]} className="relative mx-auto aspect-[4/5] w-full max-w-md" />
      ) : (
        <div className="relative mx-auto h-[26rem] w-full max-w-lg sm:h-[32rem]">
          <div className="absolute top-0 left-0 h-[78%] w-[64%]">
            <PhotoFrame product={photos[0]} className="h-full w-full" />
          </div>
          <div className="absolute right-0 bottom-0 h-[62%] w-[52%] ring-8 ring-white">
            <PhotoFrame product={photos[1]} className="h-full w-full" />
          </div>
        </div>
      )}
      <div className="max-w-md">
        <p className="text-[11px] tracking-[0.22em] uppercase">One of a Kind</p>
        <h2 className="mt-4 font-display text-4xl font-normal tracking-[0.04em] sm:text-5xl">{ONE_OF_A_KIND_HEADING}</h2>
        <p className="mt-5 text-sm leading-relaxed text-muted">{ONE_OF_A_KIND_BLURB}</p>
        <Link href="/one-of-a-kind" className="btn btn-choose mt-8">
          Shop One of a Kind
        </Link>
      </div>
    </section>
  );
}

function PhotoFrame({ product, className }: { product: ProductCard; className: string }) {
  return (
    <Link href={`/products/${product.slug}`} aria-label={product.name} className={`relative block overflow-hidden bg-[#2a2a2a] ${className}`}>
      {product.image ? (
        <Image src={product.image.url} alt={product.image.alt} fill sizes="(min-width: 1024px) 28vw, 80vw" className="object-cover" />
      ) : (
        <ProductPlaceholder category={product.category} />
      )}
    </Link>
  );
}

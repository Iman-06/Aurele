import Image from "next/image";
import Link from "next/link";
import type { ProductCard } from "@/server/catalog/catalog";
import { needsChoice, priceRange } from "@/lib/store-categories";
import { AddButton } from "./add-button";
import { ProductPlaceholder } from "./product-placeholder";

export function ProductCardView({
  product,
  imageSizes = "(min-width: 1024px) 25vw, 50vw",
  priority = false,
}: {
  product: ProductCard;
  imageSizes?: string;
  priority?: boolean;
}) {
  const href = `/products/${product.slug}`;

  return (
    <article className="group flex flex-col gap-3">
      <div className="relative">
        <Link href={href} aria-label={product.name} className="relative block aspect-square overflow-hidden bg-[#f4f4f4]">
          {product.image ? (
            <Image src={product.image.url} alt={product.image.alt} fill sizes={imageSizes} priority={priority} className="object-cover" />
          ) : (
            <ProductPlaceholder category={product.category} />
          )}
        </Link>
        {!product.inStock && (
          <span className="pointer-events-none absolute top-3 left-3 bg-[#efefef] px-2 py-1 text-[11px] tracking-[0.08em] text-black/65 uppercase">
            Sold out
          </span>
        )}
        {product.inStock && (
          <div className="card-action absolute inset-x-3 bottom-3 z-10">
            {needsChoice(product) ? (
              <Link href={href} className="btn btn-overlay">
                Choose
              </Link>
            ) : (
              <AddButton slug={product.slug} className="btn-overlay" />
            )}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Link href={href} className="text-sm">
          {product.name}
        </Link>
        <p className="text-sm text-muted">{priceRange(product.priceFrom, product.priceTo)}</p>
      </div>
    </article>
  );
}

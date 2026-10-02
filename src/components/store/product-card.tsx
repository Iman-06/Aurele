import Image from "next/image";
import Link from "next/link";
import type { ProductCard } from "@/server/catalog/catalog";
import { needsChoice, priceRange } from "@/lib/store-categories";
import { AddButton } from "./add-button";
import { ProductPlaceholder } from "./product-placeholder";

export function ProductCardView({ product }: { product: ProductCard }) {
  const href = `/products/${product.slug}`;

  return (
    <article className="flex flex-col gap-5">
      <Link href={href} aria-label={product.name} className="relative block aspect-[4/5] overflow-hidden bg-surface">
        {product.image ? (
          <Image src={product.image.url} alt={product.image.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
        ) : (
          <ProductPlaceholder category={product.category} />
        )}
      </Link>
      <div className="space-y-1">
        <Link href={href} className="text-sm">
          {product.name}
        </Link>
        <p className="text-sm text-muted">{priceRange(product.priceFrom, product.priceTo)}</p>
      </div>
      {product.inStock ? (
        needsChoice(product) ? (
          <Link href={href} className="btn btn-choose self-start">
            Choose
          </Link>
        ) : (
          <div className="self-start">
            <AddButton slug={product.slug} />
          </div>
        )
      ) : (
        <p className="text-[0.7rem] tracking-[0.18em] text-muted uppercase">Out of Stock</p>
      )}
    </article>
  );
}

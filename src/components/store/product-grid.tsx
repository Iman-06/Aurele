import type { ProductCard } from "@/server/catalog/catalog";
import { ProductCardView } from "./product-card";

export function ProductGrid({ products }: { products: ProductCard[] }) {
  if (!products.length) {
    return <p className="text-sm text-muted">Nothing here yet.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-8 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCardView product={product} />
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useRef } from "react";
import type { ProductCard } from "@/server/catalog/catalog";
import { ProductCardView } from "./product-card";

export function JustInCarousel({ products }: { products: ProductCard[] }) {
  const scroller = useRef<HTMLUListElement>(null);

  function move(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.75, 280), behavior: "smooth" });
  }

  if (!products.length) {
    return <p className="px-6 text-center text-sm text-muted sm:px-10">Nothing here yet.</p>;
  }

  return (
    <div className="relative">
      {products.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => move(-1)}
            className="absolute top-[30%] left-3 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => move(1)}
            className="absolute top-[30%] right-3 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white"
          >
            <Chevron direction="right" />
          </button>
        </>
      )}
      <ul ref={scroller} className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-2 sm:px-12">
        {products.map((product, index) => (
          <li key={product.id} className="w-[72vw] shrink-0 snap-start sm:w-72 lg:w-80">
            <ProductCardView product={product} imageSizes="(min-width: 1024px) 20rem, 72vw" priority={index === 0} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.25">
      <path d={direction === "left" ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

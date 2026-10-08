"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { NO_COLOUR } from "@/lib/cart-types";
import { formatRs } from "@/lib/format";
import type { ProductDetail } from "@/server/catalog/catalog";
import { ProductPlaceholder } from "./product-placeholder";

const optionClass = (selected: boolean) =>
  `min-h-11 border px-4 text-[0.7rem] tracking-[0.16em] uppercase transition-colors ${
    selected ? "border-foreground bg-foreground text-background" : "border-line hover:border-gold"
  }`;

export function ProductPurchase({ product }: { product: ProductDetail }) {
  const addItem = useCartStore((s) => s.addItem);
  const openMiniCart = useCartStore((s) => s.openMiniCart);
  const [finishIndex, setFinishIndex] = useState(0);
  const [colourIndex, setColourIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const finish = product.finishes[finishIndex] ?? product.finishes[0];
  const colour = finish?.colours[Math.min(colourIndex, Math.max(finish.colours.length - 1, 0))];
  const variant = colour?.variants[Math.min(variantIndex, Math.max(colour.variants.length - 1, 0))];
  const images = colour ? colour.images : product.images;
  const activeIndex = images.length ? Math.min(imageIndex, images.length - 1) : 0;
  const photo = images[activeIndex];

  function chooseFinish(index: number) {
    setFinishIndex(index);
    setColourIndex(0);
    setVariantIndex(0);
    setImageIndex(0);
    setAdded(false);
  }

  function add() {
    if (!finish || !colour || !variant) return;
    addItem({
      variantId: variant.variantId,
      productId: product.id,
      name: product.name,
      finish: finish.finish,
      colour: colour.colour,
      size: variant.size,
      photoRef: photo?.url ?? null,
      priceAtAdd: variant.price,
    });
    setAdded(true);
    openMiniCart();
  }

  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
      <div>
        <div className="relative aspect-square overflow-hidden bg-[#f4f4f4]">
          {photo ? (
            <Image key={photo.url} src={photo.url} alt={photo.alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" priority />
          ) : (
            <ProductPlaceholder category={product.category} />
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex gap-3">
            {images.map((image, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={`${image.url}-${index}`}
                  type="button"
                  aria-label={`Photo ${index + 1} of ${images.length}`}
                  aria-current={selected ? "true" : undefined}
                  className={`relative size-16 overflow-hidden border bg-[#f4f4f4] ${selected ? "border-foreground" : "border-line"}`}
                  onClick={() => setImageIndex(index)}
                >
                  <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-normal">{product.name}</h1>
          <p className="text-sm">{variant ? formatRs(variant.price) : formatRs(product.priceFrom)}</p>
          {product.description && <p className="max-w-md text-sm leading-relaxed text-muted">{product.description}</p>}
        </div>

        {!product.inStock || !finish || !colour || !variant ? (
          <p className="text-[0.7rem] tracking-[0.18em] text-muted uppercase">Out of Stock</p>
        ) : (
          <>
            {product.showFinishSelector && (
              <fieldset className="space-y-3">
                <legend className="text-[0.7rem] tracking-[0.18em] text-muted uppercase">Finish</legend>
                <div className="flex flex-wrap gap-3">
                  {product.finishes.map((option, index) => (
                    <button key={option.finish} type="button" className={optionClass(index === finishIndex)} onClick={() => chooseFinish(index)}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {finish.showColourSelector && (
              <fieldset className="space-y-3">
                <legend className="text-[0.7rem] tracking-[0.18em] text-muted uppercase">Colour</legend>
                <div className="flex flex-wrap gap-3">
                  {finish.colours.map((option, index) =>
                    option.colour === NO_COLOUR ? null : (
                      <button
                        key={option.colour}
                        type="button"
                        className={optionClass(option.colour === colour.colour)}
                        onClick={() => {
                          setColourIndex(index);
                          setVariantIndex(0);
                          setImageIndex(0);
                          setAdded(false);
                        }}
                      >
                        {option.colour}
                      </button>
                    ),
                  )}
                </div>
              </fieldset>
            )}

            {colour.showSizeSelector && (
              <fieldset className="space-y-3">
                <legend className="text-[0.7rem] tracking-[0.18em] text-muted uppercase">Size</legend>
                <div className="flex flex-wrap gap-3">
                  {colour.variants.map((option, index) => (
                    <button
                      key={option.variantId}
                      type="button"
                      className={optionClass(option.variantId === variant.variantId)}
                      onClick={() => {
                        setVariantIndex(index);
                        setAdded(false);
                      }}
                    >
                      {option.size}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {variant.stock.status === "LOW_STOCK" && (
              <p className="text-[0.7rem] tracking-[0.18em] text-gold uppercase">Only {variant.stock.left} left</p>
            )}

            <div className="self-start">
              <Button variant="add" onClick={add} disabled={added} className="disabled:opacity-40">
                {added ? "Added" : "Add to Bag"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

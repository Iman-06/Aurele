"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { NO_COLOUR } from "@/lib/cart-types";
import { formatRs } from "@/lib/format";
import type { ColourOption, FinishOption, ProductDetail } from "@/server/catalog/catalog";
import { ProductPlaceholder } from "./product-placeholder";

function firstColourIndex(finish: FinishOption): number {
  const index = finish.colours.findIndex((colour) => colour.inStock);
  return index >= 0 ? index : 0;
}

function firstVariantIndex(colour: ColourOption): number {
  const index = colour.variants.findIndex((variant) => variant.stock.status !== "OUT_OF_STOCK");
  return index >= 0 ? index : 0;
}

function initialSelection(product: ProductDetail) {
  const empty = { finishIndex: 0, colourIndex: 0, variantIndex: 0 };
  if (product.defaultVariantId == null) return empty;
  for (let finishIndex = 0; finishIndex < product.finishes.length; finishIndex++) {
    const finish = product.finishes[finishIndex];
    for (let colourIndex = 0; colourIndex < finish.colours.length; colourIndex++) {
      const colour = finish.colours[colourIndex];
      const variantIndex = colour.variants.findIndex((variant) => variant.variantId === product.defaultVariantId);
      if (variantIndex >= 0) return { finishIndex, colourIndex, variantIndex };
    }
  }
  return empty;
}

function OptionBox({
  selected,
  soldOut,
  label,
  onSelect,
}: {
  selected: boolean;
  soldOut: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={soldOut}
      aria-pressed={selected}
      aria-disabled={soldOut}
      title={soldOut ? "Sold out" : undefined}
      onClick={onSelect}
      className={`relative inline-flex min-h-11 min-w-11 items-center justify-center border px-3 text-[0.7rem] tracking-[0.14em] uppercase ${
        soldOut
          ? "cursor-not-allowed border-[#e0e0e0] bg-[#f9f9f9] text-[#999999]"
          : selected
            ? "border-black text-black bg-white"
            : "border-[#d4d4d4] text-black hover:border-black"
      }`}
    >
      {soldOut && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_right,transparent_calc(50%-0.5px),#999999_50%,transparent_calc(50%+0.5px))]"
        />
      )}
      <span className={`relative ${soldOut ? "line-through opacity-70" : ""}`}>{label}</span>
    </button>
  );
}

export function ProductPurchase({ product }: { product: ProductDetail }) {
  const addItem = useCartStore((s) => s.addItem);
  const openMiniCart = useCartStore((s) => s.openMiniCart);
  const [selection, setSelection] = useState(() => initialSelection(product));
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const finish = product.finishes[selection.finishIndex] ?? product.finishes[0];
  const colour = finish?.colours[Math.min(selection.colourIndex, Math.max(finish.colours.length - 1, 0))];
  const variant = colour?.variants[Math.min(selection.variantIndex, Math.max(colour.variants.length - 1, 0))];
  const images = colour ? colour.images : product.images;
  const activeIndex = images.length ? Math.min(imageIndex, images.length - 1) : 0;
  const photo = images[activeIndex];
  const soldOut = !product.inStock || !variant || variant.stock.status === "OUT_OF_STOCK";
  const showSize = product.category === "RINGS" || Boolean(colour?.showSizeSelector);

  function chooseFinish(index: number) {
    const next = product.finishes[index];
    if (!next?.inStock) return;
    const colourIndex = firstColourIndex(next);
    const nextColour = next.colours[colourIndex];
    setSelection({
      finishIndex: index,
      colourIndex,
      variantIndex: nextColour ? firstVariantIndex(nextColour) : 0,
    });
    setImageIndex(0);
    setAdded(false);
  }

  function chooseColour(index: number) {
    if (!finish) return;
    const next = finish.colours[index];
    if (!next?.inStock) return;
    setSelection((current) => ({
      ...current,
      colourIndex: index,
      variantIndex: firstVariantIndex(next),
    }));
    setImageIndex(0);
    setAdded(false);
  }

  function chooseSize(index: number) {
    if (!colour || colour.variants[index]?.stock.status === "OUT_OF_STOCK") return;
    setSelection((current) => ({ ...current, variantIndex: index }));
    setAdded(false);
  }

  function add() {
    if (!finish || !colour || !variant || variant.stock.status === "OUT_OF_STOCK") return;
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
          {product.isOneOfAKind && (
            <p className="text-[11px] tracking-[0.14em] uppercase">One of a Kind</p>
          )}
          <h1 className="text-2xl font-normal">{product.name}</h1>
          <p className="text-sm">{variant ? formatRs(variant.price) : formatRs(product.priceFrom)}</p>
          {product.description && <p className="max-w-md text-sm leading-relaxed text-muted">{product.description}</p>}
        </div>

        {finish && (
          <>
            {product.showFinishSelector && (
              <fieldset className="space-y-3">
                <legend className="text-[0.7rem] tracking-[0.18em] text-muted uppercase">Finish</legend>
                <div className="flex flex-wrap gap-3">
                  {product.finishes.map((option, index) => (
                    <OptionBox
                      key={option.finish}
                      label={option.label}
                      soldOut={!option.inStock}
                      selected={option.inStock && index === selection.finishIndex}
                      onSelect={() => chooseFinish(index)}
                    />
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
                      <OptionBox
                        key={option.colour}
                        label={option.colour}
                        soldOut={!option.inStock}
                        selected={option.inStock && option.colour === colour?.colour}
                        onSelect={() => chooseColour(index)}
                      />
                    ),
                  )}
                </div>
              </fieldset>
            )}

            {showSize && colour && (
              <fieldset className="space-y-3">
                <legend className="text-[0.7rem] tracking-[0.18em] text-muted uppercase">Size</legend>
                <div className="flex flex-wrap gap-3">
                  {colour.variants.map((option, index) => {
                    const optionSoldOut = option.stock.status === "OUT_OF_STOCK";
                    return (
                      <OptionBox
                        key={option.variantId}
                        label={option.size || "One size"}
                        soldOut={optionSoldOut}
                        selected={!optionSoldOut && option.variantId === variant?.variantId}
                        onSelect={() => chooseSize(index)}
                      />
                    );
                  })}
                </div>
              </fieldset>
            )}
          </>
        )}

        {soldOut ? (
          <p className="text-[0.7rem] tracking-[0.18em] text-muted uppercase">{product.isOneOfAKind ? "Sold" : "Sold out"}</p>
        ) : (
          <>
            {variant?.stock.status === "LOW_STOCK" && (
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

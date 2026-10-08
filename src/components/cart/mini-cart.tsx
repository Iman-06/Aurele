"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { selectItems, useCartHydrated, useCartStore } from "@/lib/cart-store";
import { MAX_PER_ITEM, NO_COLOUR, type CartItem } from "@/lib/cart-types";
import { formatRs } from "@/lib/format";

function describe(item: CartItem): string {
  const parts = [item.finish === "GOLD" ? "Gold" : "Silver"];
  if (item.colour && item.colour !== NO_COLOUR) parts.push(item.colour);
  if (item.size) parts.push(`size ${item.size}`);
  return parts.join(", ");
}

export function MiniCart() {
  const open = useCartStore((s) => s.miniCartOpen);
  const close = useCartStore((s) => s.closeMiniCart);
  const hydrated = useCartHydrated();
  const items = useCartStore(selectItems);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  if (!open) return null;

  const subtotal = items.reduce((sum, item) => sum + item.priceAtAdd * item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-foreground/30" aria-label="Close cart" onClick={close} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white text-foreground shadow-xl" aria-label="Cart">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <p className="font-display text-sm tracking-[0.14em] uppercase">Cart</p>
          <button type="button" className="inline-flex size-10 items-center justify-center" aria-label="Close cart" onClick={close} autoFocus>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.25">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {!hydrated ? (
          <p className="px-6 py-8 text-sm text-muted">Loading your cart…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col gap-6 px-6 py-8">
            <p className="text-sm text-muted">Your cart is empty.</p>
            <Link href="/" className="btn btn-choose w-fit" onClick={close}>
              Browse pieces
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-4 py-6">
                  <div className="relative size-20 shrink-0 overflow-hidden bg-[#f4f4f4]">
                    {item.photoRef && <Image src={item.photoRef} alt="" fill sizes="80px" className="object-cover" />}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm">{item.name}</p>
                        <p className="mt-1 text-[0.7rem] tracking-[0.16em] text-muted uppercase">{describe(item)}</p>
                      </div>
                      <p className="text-sm tabular-nums">{formatRs(item.priceAtAdd)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center border border-line">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="size-9 text-sm disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          disabled={item.quantity >= MAX_PER_ITEM}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="size-9 text-sm disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                        className="text-[0.7rem] tracking-[0.16em] text-muted uppercase hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-4 border-t border-line px-6 py-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="tabular-nums">{formatRs(subtotal)}</span>
              </div>
              <Button variant="add" className="w-full" disabled>
                Checkout — coming soon
              </Button>
              <Link href="/cart" onClick={close} className="block text-center text-[0.7rem] tracking-[0.16em] uppercase hover:opacity-60">
                View cart
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

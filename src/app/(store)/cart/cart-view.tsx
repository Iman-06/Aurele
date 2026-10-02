"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { selectItems, useCartHydrated, useCartStore } from "@/lib/cart-store";
import {
  FALLBACK_SHIPPING_FEE,
  MAX_PER_ITEM,
  NO_COLOUR,
  maxQuantityFor,
  type CartItem,
  type CartLine,
  type CartSummary,
} from "@/lib/cart-types";
import { formatRs } from "@/lib/format";

const PROBLEM_MESSAGES: Record<NonNullable<CartLine["problem"]>, string> = {
  OUT_OF_STOCK: "Sold out — please remove this item.",
  QUANTITY_REDUCED: "We only had fewer in stock, so the quantity was reduced.",
  UNAVAILABLE: "No longer available — please remove this item.",
};

/** "Gold, Blue, size 8" — the colour sentinel and empty sizes are never shown. */
function describe(item: CartItem): string {
  const parts = [item.finish === "GOLD" ? "Gold" : "Silver"];
  if (item.colour && item.colour !== NO_COLOUR) parts.push(item.colour);
  if (item.size) parts.push(`size ${item.size}`);
  return parts.join(", ");
}

export function CartView() {
  const hydrated = useCartHydrated();
  const items = useCartStore(selectItems);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);

  // The result of the last POST /api/cart/validate, tagged with the cart it describes.
  // Keeping the tag lets us tell a fresh answer from a stale one without a loading flag
  // that would have to be set while the effect is running.
  const [check, setCheck] = useState<{ signature: string; data: CartSummary | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Recheck when a variant or its quantity changes, not on every store write.
  const signature = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");

  useEffect(() => {
    if (!hydrated || !items.length) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // `price` is what the customer last saw, so the backend can flag a change.
          body: JSON.stringify({
            items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, price: i.priceAtAdd })),
          }),
        });
        if (!res.ok) throw new Error(`cart check failed (${res.status})`);
        const data = (await res.json()) as CartSummary;
        if (!cancelled) setCheck({ signature, data, failed: false });
      } catch {
        // Keep the previous answer on screen rather than dropping back to stored prices.
        if (!cancelled) setCheck((prev) => ({ signature, data: prev?.data ?? null, failed: true }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, items, signature, attempt]);

  const summary = check?.data ?? null;
  const failed = check?.signature === signature && check.failed;
  const loading = items.length > 0 && check?.signature !== signature;

  // Apply a stock reduction only from the check that matches the cart as it is now.
  // An older answer (from before the customer raised a quantity) must not win, or the
  // stepper can never move up.
  useEffect(() => {
    if (!summary || check?.signature !== signature) return;
    for (const line of summary.lines) {
      const item = items.find((i) => i.variantId === line.variantId);
      if (item && line.quantity >= 1 && line.quantity < item.quantity) {
        updateQuantity(line.variantId, line.quantity);
      }
    }
  }, [summary, check, signature, items, updateQuantity]);

  const linesByVariant = useMemo(
    () => new Map((summary?.lines ?? []).map((l) => [l.variantId, l])),
    [summary],
  );

  if (!hydrated) {
    return <p className="mt-10 text-sm text-muted">Loading your cart…</p>;
  }

  if (!items.length) {
    return (
      <div className="mt-10 space-y-6">
        <p className="text-sm text-muted">Your cart is empty.</p>
        <Link href="/" className="btn btn-choose">
          Browse pieces
        </Link>
      </div>
    );
  }

  // Live figures from the database win; the stored prices are a display-only fallback.
  const subtotal = summary?.subtotal ?? items.reduce((s, i) => s + i.priceAtAdd * i.quantity, 0);
  const shippingFee = summary?.shippingFee ?? FALLBACK_SHIPPING_FEE;
  const total = summary?.total ?? subtotal + shippingFee;
  const checkoutBlocked = summary?.lines.some((l) => l.problem === "OUT_OF_STOCK" || l.problem === "UNAVAILABLE");

  return (
    <div className="mt-10 grid gap-16 lg:grid-cols-[1fr_20rem]">
      <ul className="divide-y divide-line border-y border-line">
        {items.map((item) => {
          const line = linesByVariant.get(item.variantId);
          const max = line ? maxQuantityFor(line.stock) : MAX_PER_ITEM;
          const unitPrice = line?.unitPrice ?? item.priceAtAdd;
          const photo = line?.image?.url ?? item.photoRef;

          return (
            <li key={item.variantId} className="flex gap-6 py-8">
              <div className="relative size-24 shrink-0 overflow-hidden bg-surface">
                {photo && (
                  <Image src={photo} alt={line?.image?.alt ?? item.name} fill sizes="96px" className="object-cover" />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <div>
                    <p className="text-sm">{line?.name ?? item.name}</p>
                    <p className="mt-1 text-[0.7rem] tracking-[0.16em] text-muted uppercase">{describe(item)}</p>
                  </div>
                  <p className="text-sm tabular-nums">{formatRs(unitPrice)}</p>
                </div>

                {line?.stock.status === "LOW_STOCK" && (
                  <p className="text-[0.7rem] tracking-[0.16em] text-gold uppercase">Only {line.stock.left} left</p>
                )}
                {line?.problem && <p className="text-xs text-gold">{PROBLEM_MESSAGES[line.problem]}</p>}
                {line?.priceChanged && (
                  <p className="text-xs text-gold">The price of this item changed — the amount above is current.</p>
                )}

                <div className="mt-1 flex items-center gap-6">
                  <div className="flex items-center border border-line">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      aria-label={`Decrease quantity of ${item.name}`}
                      className="size-9 text-sm transition-colors hover:text-gold disabled:opacity-30 disabled:hover:text-foreground"
                    >
                      −
                    </button>
                    <span aria-live="polite" className="w-9 text-center text-sm tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                      disabled={item.quantity >= max}
                      aria-label={`Increase quantity of ${item.name}`}
                      className="size-9 text-sm transition-colors hover:text-gold disabled:opacity-30 disabled:hover:text-foreground"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="text-[0.7rem] tracking-[0.16em] text-muted uppercase transition-colors hover:text-foreground"
                  >
                    Remove
                  </button>

                  {item.quantity >= max && max > 0 && (
                    <span className="text-[0.7rem] tracking-[0.16em] text-muted uppercase">
                      {max === MAX_PER_ITEM ? `Max ${MAX_PER_ITEM} per order` : "All we have"}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="space-y-6 self-start">
        <h2 className="text-[0.7rem] tracking-[0.22em] text-muted uppercase">Summary</h2>

        {failed && (
          <p className="text-xs text-gold">
            We couldn’t refresh prices and stock just now.{" "}
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="underline">
              Try again
            </button>
          </p>
        )}

        <dl className="space-y-3 border-y border-line py-6 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatRs(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Shipping</dt>
            <dd className="tabular-nums">{formatRs(shippingFee)}</dd>
          </div>
          <div className="flex justify-between pt-3 text-sm">
            <dt className="tracking-[0.16em] uppercase">Total</dt>
            <dd className="tabular-nums">{formatRs(total)}</dd>
          </div>
        </dl>

        {loading && <p className="text-xs text-muted">Checking stock and prices…</p>}

        {checkoutBlocked ? (
          <p className="text-xs text-gold">Please remove the unavailable items before checking out.</p>
        ) : (
          <Button variant="add" className="w-full" disabled>
            Checkout — coming soon
          </Button>
        )}

        <button
          type="button"
          onClick={clearCart}
          className="text-[0.7rem] tracking-[0.16em] text-muted uppercase transition-colors hover:text-foreground"
        >
          Clear cart
        </button>
      </aside>
    </div>
  );
}

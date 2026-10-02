"use client";

import Link from "next/link";
import { selectItemCount, useCartHydrated, useCartStore } from "@/lib/cart-store";

export function CartIcon() {
  const hydrated = useCartHydrated();
  const count = useCartStore(selectItemCount);
  const showCount = hydrated && count > 0;

  return (
    <Link
      href="/cart"
      aria-label={showCount ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart, empty"}
      className="relative inline-flex items-center gap-3 text-[0.65rem] tracking-[0.22em] uppercase transition-colors hover:text-gold"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-5">
        <path d="M6 7h12l1.2 12.2a1 1 0 0 1-1 1.1H5.8a1 1 0 0 1-1-1.1L6 7Z" strokeLinejoin="round" />
        <path d="M9 7V5.8a3 3 0 0 1 6 0V7" strokeLinecap="round" />
      </svg>
      <span>Cart</span>
      {showCount && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-[0.6rem] leading-none tracking-normal text-background tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}

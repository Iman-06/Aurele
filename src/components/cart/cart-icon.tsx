"use client";

import { selectItemCount, useCartHydrated, useCartStore } from "@/lib/cart-store";

export function CartIcon() {
  const hydrated = useCartHydrated();
  const count = useCartStore(selectItemCount);
  const openMiniCart = useCartStore((s) => s.openMiniCart);
  const showCount = hydrated && count > 0;

  return (
    <button
      type="button"
      onClick={openMiniCart}
      aria-label={showCount ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart, empty"}
      className="relative inline-flex size-10 items-center justify-center"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-5">
        <path d="M6 7h12l1.2 12.2a1 1 0 0 1-1 1.1H5.8a1 1 0 0 1-1-1.1L6 7Z" strokeLinejoin="round" />
        <path d="M9 7V5.8a3 3 0 0 1 6 0V7" strokeLinecap="round" />
      </svg>
      {showCount && (
        <span className="absolute top-1 right-0 inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 py-0.5 text-[0.6rem] leading-none text-white tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

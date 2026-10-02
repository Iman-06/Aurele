"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_LINES, MAX_PER_ITEM, type CartItem } from "./cart-types";

// The cart lives in the customer's browser. Nothing here is trusted for money:
// `priceAtAdd` is only for display, and stock/prices are refreshed from
// POST /api/cart/validate whenever the cart or checkout page opens.

const STORAGE_KEY = "aurele-cart";

const clamp = (q: number) => Math.min(Math.max(Math.trunc(q), 1), MAX_PER_ITEM);

export type CartStore = {
  items: CartItem[];
  /** Adds a new line, or tops up the quantity if the variant is already in the cart. */
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
  itemCount: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, ...item, quantity: clamp(i.quantity + quantity) } : i,
              ),
            };
          }
          if (state.items.length >= MAX_LINES) return state;
          return { items: [...state.items, { ...item, quantity: clamp(quantity) }] };
        }),

      removeItem: (variantId) => set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),

      updateQuantity: (variantId, quantity) =>
        set((state) => {
          if (quantity < 1) return { items: state.items.filter((i) => i.variantId !== variantId) };
          return {
            items: state.items.map((i) => (i.variantId === variantId ? { ...i, quantity: clamp(quantity) } : i)),
          };
        }),

      clearCart: () => set({ items: [] }),

      subtotal: () => get().items.reduce((sum, i) => sum + i.priceAtAdd * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export const selectItems = (s: CartStore) => s.items;
export const selectSubtotal = (s: CartStore) => s.subtotal();
export const selectItemCount = (s: CartStore) => s.itemCount();

/**
 * False until the persisted cart has been read from localStorage. Render counts and
 * totals only once this is true, otherwise the server-rendered markup (an empty cart)
 * and the first client render disagree and React reports a hydration mismatch.
 */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useCartStore.persist.onFinishHydration(onStoreChange),
    () => useCartStore.persist.hasHydrated(),
    () => false, // on the server the cart is always empty
  );
}

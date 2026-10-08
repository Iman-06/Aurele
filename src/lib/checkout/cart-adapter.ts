"use client";

import { useMemo } from "react";
import { selectItems, useCartHydrated, useCartStore } from "@/lib/cart-store";
import type { CartItem } from "@/lib/cart-types";

export type OrderItemPayload = {
  variantId: number;
  quantity: number;
};

/**
 * Adapter between storefront cart storage and checkout order creation payload.
 * The server trusts only variantId and quantity — prices/names are ignored.
 */
export function toOrderPayload(items: readonly CartItem[]): OrderItemPayload[] {
  return items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  }));
}

/**
 * Hook to access cart state for checkout.
 * Provides items, hydration status, payload conversion, and dev stub support.
 */
export function useCheckoutCart() {
  const isHydrated = useCartHydrated();
  const rawItems = useCartStore(selectItems);
  const clearCart = useCartStore((s) => s.clearCart);
  const addItem = useCartStore((s) => s.addItem);

  const orderPayload = useMemo(() => toOrderPayload(rawItems), [rawItems]);

  const isEmpty = isHydrated && rawItems.length === 0;

  /**
   * Helper for development/testing: adds a sample item so checkout can be tested
   * even if the user hasn't added anything from the catalog yet.
   */
  const addDevTestItem = (variantId = 1, price = 2500) => {
    addItem({
      variantId,
      productId: 1,
      name: "Aveline Pearl Drop (Dev Sample)",
      finish: "GOLD",
      colour: "None / Single",
      size: "",
      photoRef: null,
      priceAtAdd: price,
    });
  };

  return {
    rawItems,
    orderPayload,
    isHydrated,
    isEmpty,
    clearCart,
    addDevTestItem,
  };
}

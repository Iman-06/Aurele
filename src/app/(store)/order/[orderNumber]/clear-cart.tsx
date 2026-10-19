"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";

/**
 * Clears the customer's cart state once they have successfully navigated
 * to the Order Confirmation page.
 *
 * This ensures the cart is not cleared prematurely on the checkout page,
 * preventing any flash of an "Empty Cart" message during checkout submission.
 */
export function ClearCartOnMount() {
  useEffect(() => {
    useCartStore.getState().clearCart();
  }, []);

  return null;
}

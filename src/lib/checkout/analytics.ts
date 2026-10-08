import type { PublicOrder } from "@/server/orders/public-order";

type CartLineItem = {
  variantId: number;
  name: string;
  quantity: number;
  unitPrice?: number;
};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Lightweight, vendor-agnostic purchase funnel analytics wrapper.
 * Forwards to Google Tag Manager / GA4 (dataLayer) and Meta Pixel (fbq) if available.
 * Fails silently if no tracking script is configured.
 */

export function trackBeginCheckout(items: CartLineItem[], value: number): void {
  if (typeof window === "undefined") return;

  try {
    // GA4 / GTM
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: "begin_checkout",
        ecommerce: {
          currency: "PKR",
          value,
          items: items.map((i) => ({
            item_id: String(i.variantId),
            item_name: i.name,
            quantity: i.quantity,
            price: i.unitPrice ?? 0,
          })),
        },
      });
    }

    // Meta Pixel
    if (typeof window.fbq === "function") {
      window.fbq("track", "InitiateCheckout", {
        currency: "PKR",
        value,
        num_items: items.reduce((sum, i) => sum + i.quantity, 0),
      });
    }
  } catch (err) {
    console.warn("[analytics] begin_checkout dispatch failed:", err);
  }
}

export function trackAddPaymentInfo(paymentMethod: string, value: number): void {
  if (typeof window === "undefined") return;

  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: "add_payment_info",
        ecommerce: {
          currency: "PKR",
          value,
          payment_type: paymentMethod,
        },
      });
    }

    if (typeof window.fbq === "function") {
      window.fbq("track", "AddPaymentInfo", {
        currency: "PKR",
        value,
      });
    }
  } catch (err) {
    console.warn("[analytics] add_payment_info dispatch failed:", err);
  }
}

export function trackPurchase(order: PublicOrder): void {
  if (typeof window === "undefined") return;

  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: "purchase",
        ecommerce: {
          transaction_id: order.orderNumber,
          currency: "PKR",
          value: order.total,
          shipping: order.shippingFee,
          items: order.items.map((i) => ({
            item_name: i.name,
            item_variant: i.label,
            price: i.unitPrice,
            quantity: i.quantity,
          })),
        },
      });
    }

    if (typeof window.fbq === "function") {
      window.fbq("track", "Purchase", {
        currency: "PKR",
        value: order.total,
        content_type: "product",
      });
    }
  } catch (err) {
    console.warn("[analytics] purchase dispatch failed:", err);
  }
}

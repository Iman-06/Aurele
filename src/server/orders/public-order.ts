import type { OrderWithItems } from "./orders";
import { variantLabel } from "../inventory/stock";

// What the customer-facing API returns for an order: no internal ids, cost prices or
// stock bookkeeping — just what the confirmation page / email needs.

export function toPublicOrder(o: OrderWithItems) {
  const n = (d: { toString(): string }) => Number(d.toString());
  return {
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    customer: {
      name: o.customerName,
      email: o.email,
      phone: o.phone,
      address: o.address,
      city: o.city,
      postalCode: o.postalCode,
    },
    items: o.items.map((i) => ({
      name: i.productName,
      label: variantLabel(i),
      finish: i.finish,
      colour: i.colour,
      size: i.size,
      quantity: i.quantity,
      unitPrice: n(i.priceAtSale),
      lineTotal: n(i.priceAtSale) * i.quantity,
    })),
    delivery: o.deliveryMethod
      ? { method: o.deliveryMethod, courier: o.courier, trackingNumber: o.trackingNumber, shippedAt: o.shippedAt?.toISOString() ?? null }
      : null,
    subtotal: n(o.subtotal),
    shippingFee: n(o.shippingFee),
    total: n(o.total),
    createdAt: o.createdAt.toISOString(),
  };
}
export type PublicOrder = ReturnType<typeof toPublicOrder>;

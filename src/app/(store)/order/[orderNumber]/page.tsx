import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/format";
import { toPublicOrder } from "@/server/orders/public-order";

export const metadata: Metadata = {
  title: "Order Confirmation — Aurele",
  description: "Thank you for your order.",
  robots: {
    index: false,
    follow: false,
  },
};

interface OrderPageProps {
  params: Promise<{
    orderNumber: string;
  }>;
}

export default async function OrderConfirmationPage({ params }: OrderPageProps) {
  const { orderNumber } = await params;

  const rawOrder = await db.order.findUnique({
    where: { orderNumber },
    include: {
      items: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!rawOrder) {
    notFound();
  }

  const order = toPublicOrder(rawOrder);
  const isCod = order.paymentMethod === "COD";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
      {/* Top Banner */}
      <div className="border border-line bg-surface p-8 text-center space-y-3">
        <div className="inline-flex size-10 items-center justify-center rounded-full bg-foreground text-background text-sm">
          ✓
        </div>
        <h1 className="text-xl font-light tracking-[0.25em] uppercase">Order Confirmed</h1>
        <p className="text-xs tracking-wider text-muted uppercase">
          Thank you, {order.customer.name}. We are preparing your order.
        </p>
        <p className="pt-2 text-sm">
          Order Reference: <strong className="font-mono text-base">{order.orderNumber}</strong>
        </p>
      </div>

      {/* Main Details */}
      <div className="mt-8 space-y-8">
        {/* Payment & Delivery Notice */}
        <div className="rounded border border-line p-6 bg-surface text-sm space-y-2">
          <div className="flex items-center justify-between text-xs tracking-wider uppercase text-muted">
            <span>Payment Method</span>
            <span className="font-medium text-foreground">{order.paymentMethod}</span>
          </div>
          {isCod ? (
            <p className="text-xs text-muted">
              <strong>Cash on Delivery:</strong> Please keep the exact amount of{" "}
              <strong className="text-foreground">{formatRs(order.total)}</strong> ready for the courier rider upon delivery.
            </p>
          ) : (
            <p className="text-xs text-muted">
              <strong>Online Payment:</strong> Status: {order.paymentStatus}
            </p>
          )}
          <p className="text-[0.7rem] text-muted italic">
            Estimated delivery across Pakistan: 3 to 5 business days. You will receive an SMS/call from the courier before dispatch.
          </p>
        </div>

        {/* Purchased Items */}
        <section className="space-y-4">
          <h2 className="text-[0.7rem] font-medium tracking-[0.2em] text-foreground uppercase border-b border-line pb-2">
            Items in your Order
          </h2>
          <ul className="divide-y divide-line">
            {order.items.map((item, idx) => (
              <li key={idx} className="flex justify-between py-4 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs tracking-wider text-muted uppercase">{item.label}</p>
                  <p className="text-xs text-muted">Qty: {item.quantity}</p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-medium">{formatRs(item.lineTotal)}</p>
                  {item.quantity > 1 && (
                    <p className="text-xs text-muted">{formatRs(item.unitPrice)} each</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Totals */}
        <section className="border-t border-line pt-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span className="tabular-nums text-foreground">{formatRs(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Shipping Fee (Standard Express)</span>
            <span className="tabular-nums text-foreground">{formatRs(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-3 font-medium text-base">
            <span>Total</span>
            <span className="tabular-nums text-foreground">{formatRs(order.total)}</span>
          </div>
        </section>

        {/* Customer & Address Details */}
        <div className="grid gap-6 border-t border-line pt-6 sm:grid-cols-2 text-xs">
          <div>
            <h3 className="tracking-wider uppercase text-muted font-medium mb-2">Shipping Address</h3>
            <p className="font-medium text-foreground">{order.customer.name}</p>
            <p className="text-muted">{order.customer.address}</p>
            <p className="text-muted">
              {order.customer.city}
              {order.customer.postalCode ? `, ${order.customer.postalCode}` : ""}
            </p>
            <p className="text-muted mt-1">Phone: {order.customer.phone}</p>
          </div>
          <div>
            <h3 className="tracking-wider uppercase text-muted font-medium mb-2">Order Updates</h3>
            <p className="text-muted">
              A confirmation email has been dispatched to:
            </p>
            <p className="font-medium text-foreground mt-1">{order.customer.email}</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-6 text-center">
          <Link href="/" className="btn btn-choose">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

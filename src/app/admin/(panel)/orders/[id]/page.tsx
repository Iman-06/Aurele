import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { DeliveryFields } from "@/components/admin/delivery-fields";
import { PaymentBadge, StatusBadge, pkt } from "@/components/admin/order-badges";
import { PrintButton } from "@/components/admin/print-button";
import { btn, btnDanger, btnSecondary, card, input, label } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { formatRs, whatsappLink } from "@/lib/format";
import { getAdminOrder, type AdminOrder } from "@/server/admin/orders";
import { requireAdmin } from "@/server/auth/admin-session";
import { variantLabel } from "@/server/inventory/stock";
import { COURIERS } from "@/server/orders/orders";
import { addNoteAction, cancelOrderAction, markRefundedAction, setStatusAction, updateDeliveryAction } from "../actions";

export const metadata = { title: "Order" };

const EVENT_ICON: Record<string, string> = {
  PLACED: "🛍",
  PAID: "💳",
  REFUND_NEEDED: "⚠",
  STATUS_CHANGED: "➜",
  SHIPPING_UPDATED: "🚚",
  CANCELLED: "✕",
  REFUNDED: "↩",
  ABANDONED: "⏱",
  NOTE: "✎",
};

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const o = Number.isInteger(id) ? await getAdminOrder(db, id) : null;
  if (!o) notFound();

  const wa = whatsappLink(o.phone, `Assalam o Alaikum ${o.customerName}, this is Lunara about your order #${o.orderNumber}.`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-sm text-stone-500 hover:text-stone-800 print:hidden">
            ← Orders
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Order #{o.orderNumber}</h1>
          <p className="text-sm text-stone-500">Placed {pkt.format(o.createdAt)}</p>
          <div className="mt-2 flex flex-wrap gap-1 print:hidden">
            <StatusBadge status={o.status} />
            <PaymentBadge method={o.paymentMethod} status={o.paymentStatus} />
          </div>
        </div>
        <PrintButton className={`${btnSecondary} print:hidden`}>🖨 Print packing slip</PrintButton>
      </div>

      {o.paymentStatus === "REFUND_NEEDED" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 print:hidden">
          <p className="font-semibold">This customer paid {formatRs(o.total)} by JazzCash and must be refunded.</p>
          <p className="text-sm">{o.cancelReason}</p>
          <p className="mt-1 text-sm">JazzCash reference: {o.paymentRef ?? "—"}. Refund in the JazzCash merchant portal, then mark it below.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <section className={card}>
            <h2 className="mb-3 font-semibold">Items</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-stone-100">
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/products/${i.variant.productId}`} className="font-medium hover:underline print:no-underline">
                        {variantLabel(i)}
                      </Link>
                      <span className="block text-xs text-stone-400">{i.sku}</span>
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {i.quantity} × {formatRs(i.priceAtSale)}
                    </td>
                    <td className="py-2 text-right font-medium whitespace-nowrap">{formatRs(Number(i.priceAtSale) * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr>
                  <td colSpan={2} className="pt-3 text-right text-stone-500">
                    Subtotal
                  </td>
                  <td className="pt-3 text-right">{formatRs(o.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="text-right text-stone-500">
                    Shipping
                  </td>
                  <td className="text-right">{formatRs(o.shippingFee)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="text-right font-semibold">
                    Total {o.paymentMethod === "COD" && o.paymentStatus === "UNPAID" ? "(collect in cash)" : ""}
                  </td>
                  <td className="text-right text-base font-semibold">{formatRs(o.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Actions */}
          <div className="print:hidden">
            <Actions o={o} />
          </div>

          {/* Timeline */}
          <section className={`${card} print:hidden`}>
            <h2 className="mb-3 font-semibold">Timeline</h2>
            <ActionForm action={addNoteAction.bind(null, o.id)} submitLabel="Add note" pendingLabel="Adding…" submitClassName={`${btnSecondary} !py-1`} className="mb-4">
              <label className="block">
                <span className="sr-only">Internal note</span>
                <textarea name="note" rows={2} placeholder="Internal note (customers never see this), e.g. called, address confirmed" className={input} />
              </label>
            </ActionForm>
            <ol className="space-y-3">
              {o.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span aria-hidden className="w-5 text-center">
                    {EVENT_ICON[e.type]}
                  </span>
                  <div>
                    <p className={e.type === "REFUND_NEEDED" ? "text-red-700" : ""}>{e.message ?? e.type.replace("_", " ").toLowerCase()}</p>
                    <p className="text-xs text-stone-400">
                      {pkt.format(e.createdAt)} · {e.actor}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Customer & delivery */}
        <div className="space-y-6">
          <section className={card}>
            <h2 className="mb-3 font-semibold">Customer</h2>
            <p className="font-medium">{o.customerName}</p>
            <p className="text-sm whitespace-pre-line">{o.address}</p>
            <p className="text-sm">
              {o.city}
              {o.postalCode && ` ${o.postalCode}`}
            </p>
            <p className="mt-2 text-sm">{o.phone}</p>
            <p className="text-sm text-stone-600">{o.email}</p>
            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`} className={`${btnSecondary} !py-1 text-xs`}>
                📞 Call
              </a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} !py-1 text-xs`}>
                  WhatsApp
                </a>
              )}
              <a href={`mailto:${o.email}?subject=${encodeURIComponent(`Your Lunara order #${o.orderNumber}`)}`} className={`${btnSecondary} !py-1 text-xs`}>
                ✉ Email
              </a>
            </div>
            {o.customer && <p className="mt-2 text-xs text-stone-500 print:hidden">Has a customer account</p>}
          </section>

          <section className={card}>
            <h2 className="mb-3 font-semibold">Payment &amp; delivery</h2>
            <dl className="space-y-1 text-sm">
              <Row k="Payment" v={o.paymentMethod === "COD" ? "Cash on Delivery" : "JazzCash"} />
              {o.paymentRef && <Row k="JazzCash ref" v={o.paymentRef} />}
              {o.paidAt && <Row k="Paid" v={pkt.format(o.paidAt)} />}
              {o.deliveryMethod && <Row k="Delivery" v={o.deliveryMethod === "OWN" ? "Own delivery" : (o.courier ?? "Courier")} />}
              {o.trackingNumber && <Row k="Tracking" v={o.trackingNumber} />}
              {o.riderInfo && <Row k="Rider" v={o.riderInfo} />}
              {o.shippedAt && <Row k="Shipped" v={pkt.format(o.shippedAt)} />}
              {o.deliveredAt && <Row k="Delivered" v={pkt.format(o.deliveredAt)} />}
              {o.cancelledAt && <Row k="Cancelled" v={`${pkt.format(o.cancelledAt)} — ${o.cancelReason}`} />}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function Actions({ o }: { o: AdminOrder }) {
  const canCancel = o.status === "AWAITING_PAYMENT" || o.status === "NEW" || o.status === "PROCESSING";
  const canShip = o.status === "NEW" || o.status === "PROCESSING";
  const hasDelivery = o.status === "SHIPPED" || o.status === "DELIVERED";
  if (!canCancel && !canShip && !hasDelivery && o.paymentStatus !== "REFUND_NEEDED") return null;

  return (
    <section className={`${card} space-y-6`}>
      <h2 className="font-semibold">Next step</h2>

      {o.status === "AWAITING_PAYMENT" && (
        <p className="text-sm text-stone-600">
          Waiting for the customer to pay by JazzCash. No stock is held. It becomes Abandoned automatically after 24 hours if unpaid.
        </p>
      )}

      {o.status === "NEW" && (
        <ActionForm action={setStatusAction.bind(null, o.id, "PROCESSING")} submitLabel="Start packing (Processing)" submitClassName={btnSecondary}>
          {null}
        </ActionForm>
      )}

      {canShip && (
        <div className="rounded-lg border border-stone-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">Mark as shipped</h3>
          <ActionForm action={setStatusAction.bind(null, o.id, "SHIPPED")} submitLabel="Mark shipped" pendingLabel="Saving…" submitClassName={btn}>
            <DeliveryFields couriers={COURIERS} />
          </ActionForm>
        </div>
      )}

      {o.status === "SHIPPED" && (
        <ActionForm
          action={setStatusAction.bind(null, o.id, "DELIVERED")}
          submitLabel={o.paymentMethod === "COD" ? `Delivered — ${formatRs(o.total)} cash collected` : "Mark delivered"}
          submitClassName={btn}
        >
          {null}
        </ActionForm>
      )}

      {hasDelivery && (
        <details className="rounded-lg border border-stone-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Edit delivery details / add tracking number</summary>
          <ActionForm action={updateDeliveryAction.bind(null, o.id)} className="mt-3" submitClassName={btnSecondary}>
            <DeliveryFields
              couriers={COURIERS}
              defaults={{ method: o.deliveryMethod, courier: o.courier, trackingNumber: o.trackingNumber, riderInfo: o.riderInfo }}
            />
          </ActionForm>
        </details>
      )}

      {o.paymentStatus === "REFUND_NEEDED" && (
        <div className="rounded-lg border border-red-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-800">Refund done?</h3>
          <ActionForm action={markRefundedAction.bind(null, o.id)} submitLabel="Mark refunded" submitClassName={btn}>
            <label className="block space-y-1">
              <span className={label}>Refund reference (optional)</span>
              <input name="note" className={`${input} w-72`} placeholder="e.g. JazzCash refund ID" />
            </label>
          </ActionForm>
        </div>
      )}

      {canCancel && (
        <details className="rounded-lg border border-red-100 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-red-800">Cancel order</summary>
          <ActionForm
            action={cancelOrderAction.bind(null, o.id)}
            submitLabel="Cancel order"
            pendingLabel="Cancelling…"
            submitClassName={btnDanger}
            confirm={`Cancel order #${o.orderNumber}?${o.stockDeductedAt ? " Its items go back into stock." : ""}${o.paymentStatus === "PAID" ? " The customer paid by JazzCash and will need a refund." : ""}`}
            className="mt-3"
          >
            <label className="block space-y-1">
              <span className={label}>Reason (required)</span>
              <input name="reason" required className={`${input} w-full max-w-md`} placeholder="e.g. Customer asked to cancel" />
            </label>
          </ActionForm>
        </details>
      )}
    </section>
  );
}

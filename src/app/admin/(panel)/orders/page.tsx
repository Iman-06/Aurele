import Link from "next/link";
import { PaymentBadge, StatusBadge, pkt } from "@/components/admin/order-badges";
import { btnSecondary, input } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/format";
import { listAdminOrders, ORDER_TABS } from "@/server/admin/orders";
import { requireAdmin } from "@/server/auth/admin-session";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const data = await listAdminOrders(db, { tab: str(sp.tab) as never, q: str(sp.q), method: str(sp.method) as never, page: str(sp.page) });
  const { query } = data;

  const href = (params: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const merged = { tab: query.tab, q: query.q, method: query.method, ...params };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") u.set(k, String(v));
    return `/admin/orders?${u}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Orders</h1>

      {data.refundsNeeded > 0 && (
        <Link href={href({ tab: "action", page: undefined })} className="block rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <strong>
            {data.refundsNeeded === 1 ? "1 order needs a refund." : `${data.refundsNeeded} orders need a refund.`}
          </strong>{" "}
          Refund the customer in the JazzCash merchant portal, then open the order and click “Mark refunded”.
        </Link>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-stone-200 text-sm" aria-label="Order status">
        {ORDER_TABS.map(([tab, label]) => (
          <Link
            key={tab}
            href={href({ tab, page: undefined })}
            aria-current={query.tab === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 ${query.tab === tab ? "border-stone-900 font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
          >
            {label} <span className="text-xs text-stone-400">{data.counts[tab]}</span>
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="tab" value={query.tab} />
        <div className="w-full sm:w-72">
          <input name="q" defaultValue={query.q} placeholder="Order #, name, phone, email or tracking no." className={input} aria-label="Search orders" />
        </div>
        <select name="method" defaultValue={query.method ?? ""} className={`${input} w-auto`} aria-label="Payment method">
          <option value="">COD &amp; JazzCash</option>
          <option value="COD">COD only</option>
          <option value="JAZZCASH">JazzCash only</option>
        </select>
        <button className={btnSecondary}>Search</button>
      </form>

      {data.orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">No orders here.</p>
      ) : (
        <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {data.orders.map((o) => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-stone-50">
              <div className="min-w-0">
                <p className="font-medium">
                  #{o.orderNumber} · {o.customerName} <span className="font-normal text-stone-500">· {o.city}</span>
                </p>
                <p className="text-xs text-stone-500">
                  {pkt.format(o.createdAt)} · {o.pieces} piece{o.pieces === 1 ? "" : "s"}
                  {o.trackingNumber && ` · ${o.courier} ${o.trackingNumber}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={o.status} />
                <PaymentBadge method={o.paymentMethod} status={o.paymentStatus} />
                <span className="w-24 text-right font-medium">{formatRs(o.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data.totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {data.page > 1 && (
            <Link href={href({ page: data.page - 1 })} className={btnSecondary}>
              ← Newer
            </Link>
          )}
          <span className="text-stone-500">
            Page {data.page} of {data.totalPages}
          </span>
          {data.page < data.totalPages && (
            <Link href={href({ page: data.page + 1 })} className={btnSecondary}>
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

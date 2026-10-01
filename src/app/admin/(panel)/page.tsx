import Link from "next/link";
import { PaymentBadge, StatusBadge, pkt } from "@/components/admin/order-badges";
import { RankBars, SalesChart } from "@/components/admin/sales-chart";
import { card } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { CATEGORY_LABELS, formatRs } from "@/lib/format";
import { getDashboard, PERIODS } from "@/server/admin/dashboard";
import { requireAdmin } from "@/server/auth/admin-session";

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin();
  const days = Number((await searchParams).days) || 30;
  const d = await getDashboard(db, { days });
  const a = d.alerts;

  const alerts = [
    { n: a.refundsNeeded, text: plural(a.refundsNeeded, "order needs a refund", "orders need a refund"), href: "/admin/orders?tab=action", tone: "red" },
    { n: a.newOrders, text: plural(a.newOrders, "new order to pack", "new orders to pack"), href: "/admin/orders?tab=action", tone: "violet" },
    { n: a.outOfStock, text: plural(a.outOfStock, "item out of stock", "items out of stock"), href: "/admin/inventory?status=out", tone: "red" },
    { n: a.lowStock, text: `${plural(a.lowStock, "item", "items")} low on stock (1–${a.threshold} left)`, href: "/admin/inventory?status=low", tone: "amber" },
    { n: a.unpriced, text: `${plural(a.unpriced, "item", "items")} without a selling price (hidden on the website)`, href: "/admin/inventory?status=unpriced", tone: "amber" },
    { n: a.noPhotos, text: plural(a.noPhotos, "visible design without photos", "visible designs without photos"), href: "/admin/products?status=visible", tone: "stone" },
    { n: a.awaitingPayment, text: plural(a.awaitingPayment, "JazzCash order waiting for payment", "JazzCash orders waiting for payment"), href: "/admin/orders?tab=awaiting", tone: "stone" },
  ].filter((x) => x.n > 0);
  const toneClass: Record<string, string> = {
    red: "border-red-200 bg-red-50 text-red-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    stone: "border-stone-200 bg-white text-stone-700",
  };

  const t = d.totals;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Welcome{admin.name ? `, ${admin.name}` : ""}</h1>
          <p className="text-sm text-stone-500">Sales are COD orders placed and JazzCash orders paid — cancelled and unpaid orders don&apos;t count.</p>
        </div>
        <nav className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm" aria-label="Period">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin?days=${p}`}
              aria-current={d.days === p ? "page" : undefined}
              className={`rounded-md px-3 py-1 ${d.days === p ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
            >
              {p} days
            </Link>
          ))}
        </nav>
      </div>

      {alerts.length > 0 && (
        <section aria-label="Needs attention" className="grid gap-2 sm:grid-cols-2">
          {alerts.map((x) => (
            <Link key={x.text} href={x.href} className={`rounded-lg border px-4 py-3 text-sm hover:shadow-sm ${toneClass[x.tone]}`}>
              <strong className="text-base">{x.n}</strong> {x.text} →
            </Link>
          ))}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={`Last ${d.days} days`}>
        <Tile label="Sales (products)" value={formatRs(t.productSales)} sub={`+ ${formatRs(t.shipping)} shipping`} />
        <Tile label="Orders" value={t.orders.toLocaleString("en-PK")} sub={`${t.pieces} piece${t.pieces === 1 ? "" : "s"} sold`} />
        <Tile label="Average order" value={formatRs(t.averageOrder)} sub="incl. shipping" />
        <Tile
          label="Gross profit"
          value={formatRs(t.grossProfit)}
          sub={t.margin === null ? "add cost prices to see profit" : `${t.margin}% margin${t.piecesWithoutCost ? ` · ${t.piecesWithoutCost} pc without cost` : ""}`}
        />
      </section>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Daily sales — last {d.days} days</h2>
          <p className="text-sm text-stone-500">
            COD {formatRs(d.byMethod.COD.sales)} ({d.byMethod.COD.orders}) · JazzCash {formatRs(d.byMethod.JAZZCASH.sales)} ({d.byMethod.JAZZCASH.orders})
          </p>
        </div>
        <SalesChart daily={d.daily} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="mb-4 font-semibold">Best sellers</h2>
          {d.topDesigns.length ? (
            <RankBars
              rows={d.topDesigns.map((x) => ({
                label: x.name,
                value: x.pieces,
                sub: `${x.pieces} pc · ${formatRs(x.sales)}`,
                href: `/admin/products/${x.productId}`,
              }))}
            />
          ) : (
            <p className="text-sm text-stone-500">No sales in this period yet.</p>
          )}
        </section>
        <section className={card}>
          <h2 className="mb-4 font-semibold">Sales by category</h2>
          {d.byCategory.length ? (
            <RankBars rows={d.byCategory.map((c) => ({ label: CATEGORY_LABELS[c.category], value: c.sales, sub: `${formatRs(c.sales)} · ${c.pieces} pc` }))} />
          ) : (
            <p className="text-sm text-stone-500">No sales in this period yet.</p>
          )}
        </section>
      </div>

      <section className={card}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Latest orders</h2>
          <Link href="/admin/orders?tab=all" className="text-sm text-stone-500 hover:text-stone-800">
            All orders →
          </Link>
        </div>
        {d.recent.length ? (
          <ul className="divide-y divide-stone-100">
            {d.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:bg-stone-50">
                  <span className="text-sm">
                    <span className="font-medium">#{o.orderNumber}</span> · {o.customerName} · {o.city}
                    <span className="block text-xs text-stone-500">{pkt.format(o.createdAt)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={o.status} />
                    <PaymentBadge method={o.paymentMethod} status={o.paymentStatus} />
                    <span className="w-24 text-right text-sm font-medium">{formatRs(o.total)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">No orders yet.</p>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

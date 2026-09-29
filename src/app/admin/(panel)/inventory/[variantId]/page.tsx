import Link from "next/link";
import { notFound } from "next/navigation";
import { card } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { designCode } from "@/lib/format";
import { getStockHistory, REASON_LABELS } from "@/server/admin/inventory";
import { requireAdmin } from "@/server/auth/admin-session";
import { FINISH_LABELS, NO_COLOUR } from "@/server/inventory/catalog-rules";

export const metadata = { title: "Stock history" };

const when = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export default async function StockHistoryPage({ params }: PageProps<"/admin/inventory/[variantId]">) {
  await requireAdmin();
  const id = Number((await params).variantId);
  const h = Number.isInteger(id) ? await getStockHistory(db, id) : null;
  if (!h) notFound();
  const v = h.variant;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/inventory" className="text-sm text-stone-500 hover:text-stone-800">
          ← Inventory
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{v.product.name}</h1>
        <p className="text-sm text-stone-600">
          {FINISH_LABELS[v.finish]}
          {v.colour !== NO_COLOUR && ` · ${v.colour}`}
          {v.size && ` · size ${v.size}`} · {v.sku} · {designCode(v.product.category, v.product.articleNo)}
        </p>
        <p className="mt-2 text-lg">
          In stock now: <strong>{v.quantity}</strong>
        </p>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-semibold">Every change</h2>
        {h.movements.length === 0 ? (
          <p className="text-sm text-stone-500">No changes recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="py-2 pr-4">When (PKT)</th>
                  <th className="py-2 pr-4">Why</th>
                  <th className="py-2 pr-4 text-right">Change</th>
                  <th className="py-2 pr-4 text-right">After</th>
                  <th className="py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {h.movements.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-4 whitespace-nowrap text-stone-600">{when.format(m.createdAt)}</td>
                    <td className="py-2 pr-4">{REASON_LABELS[m.reason]}</td>
                    <td className={`py-2 pr-4 text-right font-medium ${m.change < 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {m.change > 0 ? `+${m.change}` : m.change}
                    </td>
                    <td className="py-2 pr-4 text-right">{m.quantityAfter}</td>
                    <td className="py-2 text-stone-600">
                      {m.order && <span className="mr-2">Order #{m.order.orderNumber}</span>}
                      {m.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

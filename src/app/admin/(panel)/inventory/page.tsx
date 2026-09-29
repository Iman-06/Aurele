import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { badge, btn, btnSecondary, input } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { CATEGORY_LABELS, formatRs } from "@/lib/format";
import { listInventory, type InventoryRow } from "@/server/admin/inventory";
import { requireAdmin } from "@/server/auth/admin-session";
import { FINISH_LABELS, NO_COLOUR } from "@/server/inventory/catalog-rules";
import { receiveStockAction, setQuantityAction } from "./actions";

export const metadata = { title: "Inventory" };

const STATUS = [
  ["all", "All stock"],
  ["out", "Out of stock"],
  ["low", "Low stock"],
  ["hidden", "Hidden"],
  ["unpriced", "No price"],
] as const;

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requireAdmin();
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filter = { q: str(sp.q), category: str(sp.category) as never, status: str(sp.status) as never };
  const { rows, totals, threshold } = await listInventory(db, filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="flex flex-wrap gap-2">
          {/* Plain link: the browser downloads the file */}
          <a href="/api/admin/inventory/export" className={btnSecondary}>
            ⬇ Export to Excel
          </a>
          <Link href="/admin/inventory/import" className={btn}>
            ⬆ Import from Excel
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Stock rows" value={totals.rows} />
        <Stat label="Pieces in stock" value={totals.pieces} />
        <Stat label="Out of stock" value={totals.outOfStock} tone={totals.outOfStock ? "red" : undefined} />
        <Stat label={`Low stock (1–${threshold})`} value={totals.lowStock} tone={totals.lowStock ? "amber" : undefined} />
      </div>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="w-full sm:w-64">
          <input name="q" defaultValue={filter.q} placeholder="Search name, SKU or colour" className={input} aria-label="Search" />
        </div>
        <select name="category" defaultValue={filter.category ?? ""} className={`${input} w-auto`} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filter.status ?? "all"} className={`${input} w-auto`} aria-label="Stock status">
          {STATUS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className={btnSecondary}>Filter</button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">Nothing matches.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.variantId} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ r }: { r: InventoryRow }) {
  const hidden = !r.isActive || !r.productActive;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-stone-200 bg-white p-3">
      <div className="min-w-48 flex-1">
        <Link href={`/admin/products/${r.productId}`} className="font-medium hover:underline">
          {r.productName}
        </Link>
        <p className="text-sm text-stone-600">
          {FINISH_LABELS[r.finish]}
          {r.colour !== NO_COLOUR && ` · ${r.colour}`}
          {r.size && ` · size ${r.size}`} <span className="text-xs text-stone-400">{r.sku}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          {r.stock.status === "OUT_OF_STOCK" && <span className={`${badge} bg-red-50 text-red-700`}>Out of stock</span>}
          {r.stock.status === "LOW_STOCK" && <span className={`${badge} bg-amber-50 text-amber-800`}>Low stock</span>}
          {hidden && <span className={`${badge} bg-stone-100 text-stone-600`}>Hidden</span>}
          {r.sellingPrice === null && <span className={`${badge} bg-amber-50 text-amber-800`}>No price</span>}
          <span className="text-stone-500">{formatRs(r.sellingPrice)}</span>
          <Link href={`/admin/inventory/${r.variantId}`} className="ml-2 text-stone-500 underline hover:text-stone-800">
            History
          </Link>
        </div>
      </div>

      {/* resetKey: after any change the box refills with the real current number */}
      <ActionForm
        action={setQuantityAction.bind(null, r.variantId, r.quantity)}
        resetKey={r.updatedAt.getTime()}
        submitLabel="Set"
        submitClassName={`${btnSecondary} !py-1`}
        className="flex items-end gap-2"
      >
        <label className="block space-y-1">
          <span className="block text-xs text-stone-500">Quantity</span>
          <input name="quantity" defaultValue={r.quantity} inputMode="numeric" className={`${input} w-20`} aria-label={`Quantity of ${r.productName} ${r.sku}`} />
        </label>
      </ActionForm>

      <ActionForm
        action={receiveStockAction.bind(null, r.variantId)}
        submitLabel="+ Received"
        pendingLabel="Adding…"
        submitClassName={`${btn} !py-1`}
        className="flex items-end gap-2"
      >
        <label className="block space-y-1">
          <span className="block text-xs text-stone-500">Arrived</span>
          <input name="add" inputMode="numeric" placeholder="0" className={`${input} w-20`} aria-label={`Pieces received of ${r.productName} ${r.sku}`} />
        </label>
      </ActionForm>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" }) {
  const color = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-stone-900";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { badge, btn, btnSecondary, input } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { CATEGORY_LABELS, designCode } from "@/lib/format";
import { listAdminProducts } from "@/server/admin/products";
import { requireAdmin } from "@/server/auth/admin-session";

export const metadata = { title: "Products" };

const STATUS = [
  ["all", "All"],
  ["visible", "Visible"],
  ["hidden", "Hidden"],
  ["unpriced", "Missing prices"],
  ["new", "New Arrivals"],
] as const;

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filter = { q: str(sp.q), category: str(sp.category) as never, status: str(sp.status) as never };
  const rows = await listAdminProducts(db, filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link href="/admin/products/new" className={btn}>
          + Add design
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="w-full sm:w-64">
          <input name="q" defaultValue={filter.q} placeholder="Search name, SKU or article no." className={input} aria-label="Search" />
        </div>
        <select name="category" defaultValue={filter.category ?? ""} className={`${input} w-auto`} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filter.status ?? "all"} className={`${input} w-auto`} aria-label="Status">
          {STATUS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className={btnSecondary}>Filter</button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">No designs match.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="p-3">Design</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Rows</th>
                <th className="p-3 text-right">In stock</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50">
                  <td className="p-3">
                    <Link href={`/admin/products/${r.id}`} className="flex items-center gap-3">
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-stone-100">
                        {r.thumbnail && <Image src={r.thumbnail} alt="" fill sizes="40px" className="object-cover" unoptimized />}
                      </span>
                      <span>
                        <span className="block font-medium text-stone-900">{r.name}</span>
                        <span className="text-xs text-stone-500">{designCode(r.category, r.articleNo)}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="p-3 text-stone-600">{CATEGORY_LABELS[r.category]}</td>
                  <td className="p-3 text-right">{r.variantCount}</td>
                  <td className="p-3 text-right">{r.totalStock}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {r.isActive ? (
                        <span className={`${badge} bg-emerald-50 text-emerald-700`}>Visible</span>
                      ) : (
                        <span className={`${badge} bg-stone-100 text-stone-600`}>Hidden</span>
                      )}
                      {r.isNewArrival && <span className={`${badge} bg-violet-50 text-violet-700`}>New</span>}
                      {r.unpricedCount > 0 && (
                        <span className={`${badge} bg-amber-50 text-amber-800`}>
                          {r.unpricedCount} unpriced
                        </span>
                      )}
                      {r.imageCount === 0 && <span className={`${badge} bg-stone-100 text-stone-600`}>No photos</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-stone-500">
        Items only appear on the website when the design is Visible and the row has a selling price.
      </p>
    </div>
  );
}

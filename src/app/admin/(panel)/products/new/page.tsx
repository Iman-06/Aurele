import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { card, input, label } from "@/components/admin/ui";
import { CATEGORY_LABELS } from "@/lib/format";
import { requireAdmin } from "@/server/auth/admin-session";
import { createProductAction } from "../actions";

export const metadata = { title: "Add design" };

export default async function NewProductPage() {
  await requireAdmin();
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-stone-500 hover:text-stone-800">
          ← Products
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Add a design</h1>
        <p className="text-sm text-stone-500">After saving you can add its finishes, colours, prices and photos.</p>
      </div>
      <div className={card}>
        <ActionForm action={createProductAction} submitLabel="Create design" pendingLabel="Creating…" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="category" className={label}>
                Category
              </label>
              <select id="category" name="category" required className={input} defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="articleNo" className={label}>
                Article No.
              </label>
              <input id="articleNo" name="articleNo" inputMode="numeric" placeholder="Automatic" className={input} />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="name" className={label}>
              Name
            </label>
            <input id="name" name="name" required placeholder="e.g. Aveline Pearl Drop" className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="description" className={label}>
              Description
            </label>
            <textarea id="description" name="description" rows={4} className={input} />
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isActive" defaultChecked /> Visible on the website
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isNewArrival" /> New Arrival
            </label>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}

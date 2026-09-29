import Link from "next/link";
import { requireAdmin } from "@/server/auth/admin-session";
import { ImportFlow } from "./import-flow";

export const metadata = { title: "Import from Excel" };

export default async function ImportPage() {
  await requireAdmin();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/inventory" className="text-sm text-stone-500 hover:text-stone-800">
          ← Inventory
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Import from Excel</h1>
        <p className="text-sm text-stone-600">
          Upload the inventory workbook (same layout as the original, or a file from <em>Export to Excel</em>). You&apos;ll see exactly what
          will change before anything is saved. Rows missing from the sheet are never deleted, and empty price cells never erase prices.
        </p>
      </div>
      <ImportFlow />
    </div>
  );
}

import Link from "next/link";
import { btn, btnSecondary } from "@/components/admin/ui";

// Admin 404: a missing order / product / stock row, or an admin address that doesn't exist.
// Rendered inside the admin layout, so the menu is still there.
export default function AdminNotFound() {
  return (
    <div className="max-w-xl space-y-4 py-6">
      <h1 className="text-2xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="text-stone-600">
        It may have been deleted, or the link has a typo. Pick where you want to go:
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin" className={btn}>
          Dashboard
        </Link>
        <Link href="/admin/orders" className={btnSecondary}>
          Orders
        </Link>
        <Link href="/admin/products" className={btnSecondary}>
          Products
        </Link>
      </div>
    </div>
  );
}

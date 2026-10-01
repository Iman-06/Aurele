import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/admin-session";
import { logout } from "../auth-actions";

export const metadata: Metadata = {
  title: { default: "Lunara Admin", template: "%s · Lunara Admin" },
  robots: { index: false, follow: false },
};

// Sections are added as the admin steps are built (products, inventory, orders).
const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  // Shell only — each page and Server Action also runs its own requireAdmin() check.
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-serif text-xl tracking-wide">
              Lunara <span className="text-sm text-stone-500">Admin</span>
            </Link>
            <nav className="flex gap-4 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-stone-600 hover:text-stone-900">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-stone-500 sm:inline">{admin.name ?? admin.email}</span>
            <form action={logout}>
              <button type="submit" className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

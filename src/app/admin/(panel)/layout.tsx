import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Wordmark } from "@/components/store/brand-mark";
import { BRAND_NAME } from "@/lib/storefront";
import { requireAdmin } from "@/server/auth/admin-session";
import { logout } from "../auth-actions";

export const metadata: Metadata = {
  title: { default: `${BRAND_NAME} Admin`, template: `%s · ${BRAND_NAME} Admin` },
  robots: { index: false, follow: false },
};

// Sections are added as the admin steps are built (products, inventory, orders).
const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/homepage", label: "Homepage" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  // Shell only — each page and Server Action also runs its own requireAdmin() check.
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-white text-[#1c1c1c]">
      <header className="border-b border-[#e6e6e6] bg-white print:hidden">
        <div className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/admin" aria-label={`${BRAND_NAME} Admin`} className="flex min-h-11 shrink-0 items-center gap-3">
            <Wordmark variant="dark" crop="word" className="h-7" />
            <span className="text-[11px] tracking-[0.14em] text-[#6b6b6b] uppercase">Admin</span>
          </Link>
          <AdminNav items={NAV} />
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden text-[#6b6b6b] md:inline">{admin.name ?? admin.email}</span>
            <form action={logout}>
              <button type="submit" className="inline-flex min-h-11 items-center border border-[#1c1c1c] px-3 text-[11px] font-medium tracking-[0.14em] uppercase hover:bg-[#f4f4f4]">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

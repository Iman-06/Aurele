import Link from "next/link";
import { Suspense } from "react";
import { CartIcon } from "@/components/cart/cart-icon";
import { MobileNav } from "@/components/store/mobile-nav";
import { SearchForm } from "@/components/store/search-form";

const POLICIES = [
  { href: "/shipping", label: "Shipping" },
  { href: "/returns", label: "Returns" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const NAV = [
  { href: "/", label: "Shop" },
  { href: "/new-arrivals", label: "New Arrivals" },
  { href: "/earrings", label: "Earrings" },
  { href: "/rings", label: "Rings" },
  { href: "/bracelets", label: "Bracelets" },
  { href: "/necklaces", label: "Necklaces" },
];

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-8 py-8 sm:px-12">
          <div className="flex items-center gap-4">
            <MobileNav />
            <Link href="/" className="shrink-0 text-sm tracking-[0.42em] uppercase">
              Aurele
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-4 sm:gap-8">
              <span className="hidden text-[0.65rem] tracking-[0.22em] text-gold uppercase lg:inline">Fine jewelry</span>
              <Suspense fallback={<div className="hidden h-10 min-w-0 flex-1 sm:max-w-xs lg:block" />}>
                <SearchForm className="hidden lg:block" />
              </Suspense>
              <CartIcon />
            </div>
          </div>
          <nav className="hidden flex-wrap gap-x-8 gap-y-3 text-[0.7rem] tracking-[0.18em] uppercase lg:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-muted transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-12">
          <div className="space-y-2">
            <p className="text-sm tracking-[0.42em] uppercase">Aurele</p>
            <p className="text-sm text-muted">Quiet pieces, made to be worn every day.</p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[0.7rem] tracking-[0.16em] uppercase">
              {POLICIES.map((item) => (
                <Link key={item.href} href={item.href} className="text-muted transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className="text-[0.7rem] tracking-[0.16em] text-muted uppercase">Lahore</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { CartIcon } from "@/components/cart/cart-icon";
import { MiniCart } from "@/components/cart/mini-cart";
import { Wordmark } from "@/components/store/brand-mark";
import { CategoryMenu } from "@/components/store/category-menu";
import { MobileNav } from "@/components/store/mobile-nav";
import { SearchToggle } from "@/components/store/search-toggle";
import { cardo, petrona } from "@/lib/fonts";
import { db } from "@/lib/db";
import { ABOUT_BLURB, ANNOUNCEMENT, BRAND_NAME, INSTAGRAM_URL } from "@/lib/storefront";
import { getStoreDetails } from "@/server/settings";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/new-arrivals", label: "New Arrivals" },
  { href: "/one-of-a-kind", label: "One of a Kind" },
  { href: "/store", label: "Store" },
];

const FOOTER_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/returns", label: "Return & Exchange Policy" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/shipping", label: "Shipping Policy" },
];

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const details = await getStoreDetails(db).catch(() => null);
  const announcement = details?.announcement ?? ANNOUNCEMENT;
  const about = details?.aboutBlurb ?? ABOUT_BLURB;
  const instagramUrl = details?.instagramUrl ?? INSTAGRAM_URL;

  return (
    <div className={`${cardo.variable} ${petrona.variable} ${cardo.className} storefront flex min-h-full flex-1 flex-col bg-white text-[#1c1c1c]`}>
      <div className="bg-[#1c1c1c] text-white">
        <p className="px-4 py-2 text-center text-[11px] tracking-[0.14em] uppercase">{announcement}</p>
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-[4.5rem] items-center gap-3 px-4 sm:gap-6 sm:px-8">
          <MobileNav />
          <Link href="/" aria-label={BRAND_NAME} className="shrink-0">
            <Wordmark variant="dark" crop="word" className="h-8" />
          </Link>
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="font-display text-[13px] tracking-[0.03em] uppercase hover:opacity-60">
                {item.label}
              </Link>
            ))}
            <CategoryMenu />
          </nav>
          <div className="ml-auto flex items-center">
            <Suspense fallback={<span className="inline-flex size-10" />}>
              <SearchToggle />
            </Suspense>
            <CartIcon />
          </div>
        </div>
      </header>
      <MiniCart />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-8 py-14 sm:px-12 md:grid-cols-2">
          <div>
            <p className="font-display text-sm tracking-[0.08em]">{BRAND_NAME}</p>
            <nav className="mt-6 flex flex-col gap-5 text-sm text-muted" aria-label="Footer">
              {FOOTER_LINKS.map((item) => (
                <Link key={item.href} href={item.href} className="w-fit hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="mt-8 inline-flex size-10 items-center justify-center text-muted hover:text-foreground"
            >
              <InstagramIcon />
            </a>
          </div>
          <div>
            <p className="text-sm">About us</p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{about}</p>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-8 pb-10 text-sm sm:px-12">© 2026 {BRAND_NAME}</p>
      </footer>
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.25">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

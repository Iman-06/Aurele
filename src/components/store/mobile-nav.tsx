"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { STORE_CATEGORIES } from "@/lib/store-categories";

const itemClass = "block py-3 text-sm tracking-[0.18em] uppercase";

export function MobileNav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  function follow(href: string) {
    router.push(href);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.25">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-foreground/30" aria-label="Close menu" onClick={close} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white px-8 py-8 text-foreground shadow-xl">
            <button type="button" className="mb-10 inline-flex size-10 items-center justify-center self-start" aria-label="Close menu" onClick={close}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.25">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <nav className="flex flex-col">
              <Link href="/" className={itemClass} onClick={(event) => { event.preventDefault(); follow("/"); }}>
                Home
              </Link>
              <Link href="/new-arrivals" className={itemClass} onClick={(event) => { event.preventDefault(); follow("/new-arrivals"); }}>
                New Arrivals
              </Link>
              <button
                type="button"
                className={`${itemClass} text-left`}
                aria-expanded={categoriesOpen}
                onClick={() => setCategoriesOpen((value) => !value)}
              >
                Shop by Categories
              </button>
              {categoriesOpen && (
                <div className="flex flex-col pl-4">
                  {STORE_CATEGORIES.map((category) => (
                    <Link
                      key={category.slug}
                      href={`/${category.slug}`}
                      className={itemClass}
                      onClick={(event) => {
                        event.preventDefault();
                        follow(`/${category.slug}`);
                      }}
                    >
                      {category.label}
                    </Link>
                  ))}
                </div>
              )}
              <Link href="/search" className={itemClass} onClick={(event) => { event.preventDefault(); follow("/search"); }}>
                Search
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

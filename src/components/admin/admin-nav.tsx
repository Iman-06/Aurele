"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const linkClass = "flex min-h-11 items-center px-3 text-sm text-[#6b6b6b] hover:text-[#1c1c1c]";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function current(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  return (
    <>
      <nav className="hidden min-w-0 items-center md:flex" aria-label="Admin">
        {items.map((item) => (
          <Link key={item.href} href={item.href} aria-current={current(item.href) ? "page" : undefined} className={linkClass}>
            {item.label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        className="order-last inline-flex size-11 shrink-0 items-center justify-center border border-[#1c1c1c] md:hidden"
        aria-expanded={open}
        aria-controls="admin-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <span aria-hidden className="flex w-4 flex-col gap-1">
          <span className={`block h-px w-full bg-[#1c1c1c] ${open ? "translate-y-[5px] rotate-45" : ""}`} />
          <span className={`block h-px w-full bg-[#1c1c1c] ${open ? "opacity-0" : ""}`} />
          <span className={`block h-px w-full bg-[#1c1c1c] ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
        </span>
      </button>
      {open && (
        <nav id="admin-menu" className="absolute inset-x-0 top-full z-30 border-b border-[#e6e6e6] bg-white px-2 py-2 md:hidden" aria-label="Admin">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current(item.href) ? "page" : undefined}
              className={`${linkClass} ${current(item.href) ? "text-[#1c1c1c]" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

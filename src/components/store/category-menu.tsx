"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HEADER_CATEGORIES } from "@/lib/store-categories";

export function CategoryMenu() {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pinned) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPinned(false);
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setPinned(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [pinned]);

  function close() {
    setHover(false);
    setPinned(false);
  }

  return (
    <div ref={root} className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        className="font-display text-[13px] tracking-[0.03em] uppercase"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setPinned((value) => !value)}
      >
        Shop by Categories
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 min-w-44 border border-line bg-white py-2" role="menu">
          {HEADER_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/${category.slug}`}
              role="menuitem"
              className="block px-4 py-2 text-[13px] tracking-[0.03em] uppercase hover:bg-[#f4f4f4]"
              onClick={close}
            >
              {category.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

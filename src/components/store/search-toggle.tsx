"use client";

import { useEffect, useRef, useState } from "react";
import { SearchForm } from "./search-form";

export function SearchToggle() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center"
        aria-label="Search"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.25">
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 w-[min(18rem,calc(100vw-2rem))] border border-line bg-white p-4">
          <SearchForm className="w-full" autoFocus />
        </div>
      )}
    </div>
  );
}

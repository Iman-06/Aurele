"use client";

import { useId } from "react";
import { useSearchParams } from "next/navigation";

/** Submits to /search?q= — the catalog search for a product name. */
export function SearchForm({ className = "", autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const id = useId();
  const current = useSearchParams().get("q") ?? "";

  return (
    <form action="/search" method="get" role="search" className={`flex items-stretch gap-2 ${className || "min-w-0 flex-1 sm:max-w-xs"}`}>
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <input
        id={id}
        name="q"
        type="search"
        key={current}
        defaultValue={current}
        placeholder="Search"
        maxLength={100}
        autoFocus={autoFocus}
        className="min-w-0 flex-1 border border-line bg-white px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-foreground"
      />
      <button type="submit" className="shrink-0 border border-foreground px-4 text-[0.7rem] tracking-[0.14em] uppercase">
        Search
      </button>
    </form>
  );
}

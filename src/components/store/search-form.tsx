"use client";

import { useSearchParams } from "next/navigation";

/** Submits to /search?q= — the catalog search for a product name. */
export function SearchForm({ className = "" }: { className?: string }) {
  const current = useSearchParams().get("q") ?? "";

  return (
    <form action="/search" method="get" role="search" className={`min-w-0 flex-1 sm:max-w-xs ${className}`.trim()}>
      <label htmlFor="store-search" className="sr-only">
        Search
      </label>
      <input
        id="store-search"
        name="q"
        type="search"
        key={current}
        defaultValue={current}
        placeholder="Search"
        maxLength={100}
        className="w-full border border-line bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-gold"
      />
    </form>
  );
}

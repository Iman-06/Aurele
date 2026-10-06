"use client";

import Link from "next/link";
import { useState } from "react";

export type CategoryFilterState = {
  finish?: "gold" | "silver";
  colour?: string;
  sort: "newest" | "price_asc" | "price_desc";
};

function hrefFor(slug: string, next: CategoryFilterState) {
  const params = new URLSearchParams();
  if (next.finish) params.set("finish", next.finish);
  if (next.colour) params.set("colour", next.colour);
  if (next.sort !== "newest") params.set("sort", next.sort);
  const query = params.toString();
  return query ? `/${slug}?${query}` : `/${slug}`;
}

const choice = (selected: boolean) => (selected ? "text-foreground" : "text-muted hover:text-foreground");

export function CategoryFilters({
  slug,
  colours,
  isRings,
  current,
}: {
  slug: string;
  colours: string[];
  isRings: boolean;
  current: CategoryFilterState;
}) {
  const [open, setOpen] = useState(false);
  const link = (next: CategoryFilterState) => hrefFor(slug, next);

  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.25">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Filter
      </button>

      {open && (
        <div className="mt-6 space-y-6 border border-line bg-surface p-6 text-[0.7rem] tracking-[0.16em] uppercase">
          <fieldset className="space-y-3">
            <legend className="text-muted">Finish</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href={link({ ...current, finish: undefined })} className={choice(!current.finish)} aria-current={!current.finish ? "true" : undefined}>
                All
              </Link>
              <Link href={link({ ...current, finish: "gold" })} className={choice(current.finish === "gold")} aria-current={current.finish === "gold" ? "true" : undefined}>
                Gold
              </Link>
              <Link href={link({ ...current, finish: "silver" })} className={choice(current.finish === "silver")} aria-current={current.finish === "silver" ? "true" : undefined}>
                Silver
              </Link>
            </div>
          </fieldset>

          {colours.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="text-muted">Colour</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Link href={link({ ...current, colour: undefined })} className={choice(!current.colour)} aria-current={!current.colour ? "true" : undefined}>
                  All
                </Link>
                {colours.map((colour) => (
                  <Link
                    key={colour}
                    href={link({ ...current, colour })}
                    className={choice(current.colour?.toLowerCase() === colour.toLowerCase())}
                    aria-current={current.colour?.toLowerCase() === colour.toLowerCase() ? "true" : undefined}
                  >
                    {colour}
                  </Link>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-3">
            <legend className="text-muted">Price</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href={link({ ...current, sort: "price_desc" })} className={choice(current.sort === "price_desc")} aria-current={current.sort === "price_desc" ? "true" : undefined}>
                High to low
              </Link>
              <Link href={link({ ...current, sort: "price_asc" })} className={choice(current.sort === "price_asc")} aria-current={current.sort === "price_asc" ? "true" : undefined}>
                Low to high
              </Link>
            </div>
          </fieldset>

          {isRings && (
            <fieldset className="space-y-3">
              <legend className="text-muted">Size</legend>
              <p className="normal-case tracking-normal text-muted">Choose a size on the ring’s page. The product list has no size filter yet.</p>
            </fieldset>
          )}

          <fieldset className="space-y-3">
            <legend className="text-muted">Sort</legend>
            <Link href={link({ ...current, sort: "newest" })} className={choice(current.sort === "newest")} aria-current={current.sort === "newest" ? "true" : undefined}>
              Newest
            </Link>
          </fieldset>
        </div>
      )}
    </div>
  );
}

import type { ReactNode } from "react";

/** Shared layout for the placeholder policy pages. Copy lives in each page so the owner can edit it there. */
export function Policy({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-2xl px-8 py-16 sm:px-12">
      <h1 className="text-sm tracking-[0.42em] uppercase">{title}</h1>
      <div className="mt-10 space-y-8 text-sm leading-relaxed">{children}</div>
    </article>
  );
}

export function PolicySection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[0.7rem] tracking-[0.18em] uppercase">{heading}</h2>
      <div className="space-y-3 text-muted">{children}</div>
    </section>
  );
}

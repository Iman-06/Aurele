"use client";

import { useEffect } from "react";
import { btn, btnSecondary } from "./ui";

/** Friendly "Something went wrong" for the admin error boundaries. */
export function AdminErrorView({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="max-w-xl space-y-4 py-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-stone-600">
        This page couldn&apos;t load. Check your internet connection and try again. If it keeps happening, tell your developer
        {error.digest ? (
          <>
            {" "}
            and mention code <code className="bg-[#f4f4f4] px-1">{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={btn}>
          Try again
        </button>
        {/* Plain <a>: a full page load, in case the app itself is in a bad state */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/admin" className={btnSecondary}>
          Dashboard
        </a>
      </div>
    </div>
  );
}

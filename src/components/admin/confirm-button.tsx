"use client";

import type { ReactNode } from "react";

/** Submit button that asks "are you sure?" first. Use inside a <form action={serverAction}>. */
export function ConfirmButton({ message, className, children, title }: { message: string; className?: string; children: ReactNode; title?: string }) {
  return (
    <button
      type="submit"
      title={title}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

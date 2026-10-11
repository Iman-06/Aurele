"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../auth-actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-[#1c1c1c]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.email}
          className="min-h-11 w-full border border-[#e6e6e6] bg-white px-3 py-2 text-base text-[#1c1c1c] outline-none sm:text-sm focus:border-[#1c1c1c] focus:ring-2 focus:ring-[#e6e6e6]"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-[#1c1c1c]">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 w-full border border-[#e6e6e6] bg-white px-3 py-2 text-base text-[#1c1c1c] outline-none sm:text-sm focus:border-[#1c1c1c] focus:ring-2 focus:ring-[#e6e6e6]"
        />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full bg-[#1c1c1c] px-4 py-3 text-[11px] font-medium tracking-[0.18em] text-white uppercase transition hover:bg-[#2a2a2a] disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

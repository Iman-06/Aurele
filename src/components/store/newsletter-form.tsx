"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "sending" | "done" | "error";

export function NewsletterForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error?.message ?? "Please enter a valid email address.");
        return;
      }
      setStatus("done");
      setMessage("You’re on the list.");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-8 w-full max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="E-mail"
          disabled={status === "sending" || status === "done"}
          className="min-h-11 flex-1 border border-white/80 bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/70 focus:border-white disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "sending" || status === "done"}
          className="min-h-11 bg-white px-8 text-[0.7rem] tracking-[0.16em] text-[#1c1c1c] uppercase disabled:opacity-60"
        >
          {status === "sending" ? "Subscribing" : "Subscribe"}
        </button>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${status === "error" ? "text-white" : "text-white/90"}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}

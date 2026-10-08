import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Cart — Aurelé",
};

export default function CartPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <h1 className="font-display text-3xl font-normal tracking-[0.04em] uppercase">Cart</h1>
      <CartView />
    </section>
  );
}

import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Cart — Aurele",
};

export default function CartPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-16 sm:px-12">
      <h1 className="text-sm tracking-[0.42em] uppercase">Cart</h1>
      <CartView />
    </section>
  );
}

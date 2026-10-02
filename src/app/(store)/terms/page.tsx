import type { Metadata } from "next";
import Link from "next/link";
import { Policy, PolicySection } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Terms of Service — Aurele",
  description: "Prices, payment, stock, and shipping for orders placed with Aurele.",
};

export default function TermsPage() {
  return (
    <Policy title="Terms of Service">
      <PolicySection heading="Prices">
        <p>Prices are in Pakistani rupees and are taken from our records when you place the order.</p>
      </PolicySection>
      <PolicySection heading="Payment and stock">
        <p>Payment is Cash on Delivery or JazzCash. Stock is first come, first served. A piece can sell out between adding it to your bag and placing the order.</p>
      </PolicySection>
      <PolicySection heading="Shipping">
        <p>
          Shipping is a flat Rs 250 anywhere in Pakistan. See <Link href="/shipping" className="text-foreground underline">Shipping</Link> and{" "}
          <Link href="/returns" className="text-foreground underline">Returns</Link> for how delivery, cancellation, and refunds work.
        </p>
      </PolicySection>
      <PolicySection heading="Placing an order">
        <p>Placing an order means you agree to these terms.</p>
      </PolicySection>
    </Policy>
  );
}

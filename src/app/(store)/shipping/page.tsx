import type { Metadata } from "next";
import { Policy, PolicySection } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Shipping — Aurele",
  description: "Flat Rs 250 shipping anywhere in Pakistan. Cash on Delivery or JazzCash.",
};

export default function ShippingPage() {
  return (
    <Policy title="Shipping">
      <PolicySection heading="Fee">
        <p>Shipping is a flat Rs 250 anywhere in Pakistan, added to every order.</p>
      </PolicySection>
      <PolicySection heading="Delivery">
        <p>We deliver the order ourselves, or we send it by courier.</p>
        <p>A courier order includes a tracking number once it has shipped. Our own delivery does not.</p>
      </PolicySection>
      <PolicySection heading="Payment">
        <p>You can pay by Cash on Delivery or JazzCash.</p>
        <p>We do not hold a piece aside while you browse. Cash on Delivery takes it from stock when you place the order. JazzCash takes it when the payment is confirmed.</p>
      </PolicySection>
    </Policy>
  );
}

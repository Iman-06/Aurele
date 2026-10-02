import type { Metadata } from "next";
import { Policy, PolicySection } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Returns — Aurele",
  description: "How cancellation and refunds work for Cash on Delivery and JazzCash orders.",
};

export default function ReturnsPage() {
  return (
    <Policy title="Returns">
      <PolicySection heading="Before it ships">
        <p>Ask us to cancel an order before it ships and we put the pieces back in stock.</p>
      </PolicySection>
      <PolicySection heading="JazzCash">
        <p>If you paid by JazzCash and we cancel the order, or the piece sold out before we could confirm payment, we refund you.</p>
        <p>An unpaid JazzCash order is not charged and does not take stock. If it is still unpaid after 24 hours, we close it.</p>
      </PolicySection>
      <PolicySection heading="Cash on Delivery">
        <p>Stock is taken when the order is placed. Cancelling before shipping puts it back.</p>
      </PolicySection>
    </Policy>
  );
}

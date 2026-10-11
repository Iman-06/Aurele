import type { Metadata } from "next";
import { Policy, PolicySection } from "@/components/store/policy";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Returns — Aurelé",
  description: "Aurelé’s 3-day exchange policy. If an order can’t be fulfilled, it is cancelled and the customer isn’t charged. Aurele.",
};

export default function ReturnsPage() {
  return (
    <Policy title="Returns">
      <p className="text-muted">We have a 3-day exchange policy, which means you have 3 days after receiving your item to request an exchange.</p>
      <p className="text-muted">
        To be eligible for an exchange, your item must be in the same condition that you received it, unworn or unused, with tags, and in its original packaging. You’ll also need the receipt or proof of purchase. Delivery charges will not be included in the exchange value; only the item’s price will be considered.
      </p>
      <p className="text-muted">
        {SUPPORT_EMAIL ? (
          <>
            To start an exchange, contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline">
              {SUPPORT_EMAIL}
            </a>
            .{" "}
          </>
        ) : (
          "To start an exchange, contact us. "
        )}
        Items sent back to us without first requesting a return will not be accepted.
      </p>
      <PolicySection heading="Damages and issues">
        <p>Please inspect your order upon reception and contact us immediately if the item is defective, damaged, or if you receive the wrong item, so that we can evaluate the issue and make it right.</p>
      </PolicySection>
      <PolicySection heading="Exceptions">
        <p>Unfortunately, we cannot accept exchanges on sale items or gift cards.</p>
      </PolicySection>
      <PolicySection heading="Exchanges">
        <p>The fastest way to ensure you get what you want is to return the item you have, and once the return is accepted, make a separate purchase for the new item.</p>
      </PolicySection>
      <PolicySection heading="Refunds">
        {/* TODO: When JazzCash goes live, restore the online-payment refund wording: if Aurelé cannot fulfil an order and the customer paid by JazzCash, that payment is refunded in full. */}
        <p>We don’t offer refunds for change-of-mind returns or exchanges. If Aurelé can’t fulfil an order, the order is cancelled and the customer isn’t charged.</p>
        <p>We don’t offer exchanges on sale items.</p>
      </PolicySection>
    </Policy>
  );
}

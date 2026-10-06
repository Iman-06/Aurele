import type { Metadata } from "next";
import { Policy, PolicySection } from "@/components/store/policy";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Returns — Aurele",
  description: "Aurele’s 3-day exchange policy, and when a JazzCash payment is refunded.",
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
        <p>We don’t offer refunds for change-of-mind returns or exchanges. If Aurele is unable to fulfill your order — for example, if an item sells out before it ships — and you paid by JazzCash, that payment will be refunded in full.</p>
        <p>We don’t offer exchanges on sale items.</p>
      </PolicySection>
    </Policy>
  );
}

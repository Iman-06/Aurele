import type { Metadata } from "next";
import { Policy, PolicySection } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Privacy Policy — Aurele",
  description: "What Aurele collects to deliver an order, and what we do with it.",
};

export default function PrivacyPage() {
  return (
    <Policy title="Privacy Policy">
      <PolicySection heading="What we collect">
        <p>To deliver an order we ask for your name, email, phone number, address, city, and postal code, and we keep a record of what you bought.</p>
        <p>If you join the mailing list, we keep the email address you give us.</p>
      </PolicySection>
      <PolicySection heading="Why">
        <p>We use these details to fulfil the order, contact you about it, and — only if you subscribed — send occasional notes from the shop.</p>
      </PolicySection>
      <PolicySection heading="Who else sees them">
        <p>A courier receives the delivery address when we ship that way. JazzCash handles a JazzCash payment; we do not store card details.</p>
        <p>We do not sell your details.</p>
      </PolicySection>
    </Policy>
  );
}

import type { Metadata } from "next";
import { Policy, PolicySection } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Privacy Policy — Aurele",
  description: "How Aurele collects, uses, and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <Policy title="Privacy Policy">
      <p className="text-muted">
        At Aurele, we are committed to protecting the privacy and security of our customers’ personal information. This Privacy Policy outlines how we collect, use, disclose, and protect the information you provide when interacting with our website.
      </p>
      <PolicySection heading="Information we collect">
        <p>When you use our Services, we may collect personal information that you provide directly and willingly, such as your name, email address, phone number, shipping address, and payment information. By providing your information, you allow us to use/transfer the information shared in the manner provided in this policy.</p>
      </PolicySection>
      <PolicySection heading="Usage of information">
        <p>We use the above information to process and fulfill your orders, provide customer support, respond to inquiries, improve our products, services and website functionality, personalize your shopping experience, send promotional emails and marketing communications (you may opt out at any time), and to conduct market research and analyze trends.</p>
      </PolicySection>
      <PolicySection heading="Information sharing">
        <p>We do not transfer your information to third parties in exchange for money and we will not do so. However, we may share your personal information with third parties in the following circumstances:</p>
        <p>Service providers: we may engage trusted third-party companies or individuals to facilitate our Services, such as shipping providers or payment processors. These third parties have limited access to personal information necessary to perform their tasks and are obligated to protect your information.</p>
      </PolicySection>
      <PolicySection heading="Data security">
        <p>We take reasonable measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction. However, please note that no method of transmission over the internet or electronic storage is 100% secure.</p>
      </PolicySection>
    </Policy>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Policy, PolicySection } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Terms of Service — Aurele",
  description: "The terms that govern use of the Aurele website and purchases from Aurele.",
};

export default function TermsPage() {
  return (
    <Policy title="Terms of Service">
      <p className="text-muted">Welcome to Aurele. These Terms of Service govern your access to and use of our website and the purchase of products from us. By accessing our website or placing an order, you agree to these terms.</p>
      <p className="text-muted">Please read them carefully before making a purchase.</p>
      <PolicySection heading="About Aurele">
        <p>Aurele is an online jewellery brand offering jewellery to customers across Pakistan through our website. Throughout these terms, “Aurele,” “we,” “our,” and “us” refer to the business operating this website. “You” and “customer” refer to anyone accessing our website or purchasing our products.</p>
      </PolicySection>
      <PolicySection heading="Products and descriptions">
        <p>We make reasonable efforts to display accurate product descriptions, prices, images, colours, and available variations. Product images are provided to help customers understand the appearance and details of each item. Actual colours and appearance may vary slightly due to lighting, photography, or individual screen settings. Available finishes, colours, and other variations depend on the specific product. Product availability may change as stock is sold. Customers are encouraged to review the product description and available options before placing an order.</p>
      </PolicySection>
      <PolicySection heading="Prices and payments">
        <p>All product prices will be displayed on our website in Pakistani Rupees (PKR), unless stated otherwise. We currently offer the payment methods displayed at checkout, which may include Cash on Delivery (COD) and online payments through our supported payment provider. Applicable delivery charges and any other disclosed charges will be shown during checkout before the order is placed. We reserve the right to correct genuine pricing or listing errors. If an order is affected by an error, we will contact the customer before proceeding with the affected order.</p>
      </PolicySection>
      <PolicySection heading="Orders and acceptance">
        <p>Placing an order constitutes a request to purchase the selected products. An order confirmation message does not necessarily mean the order has been finally accepted or dispatched. Orders remain subject to product availability and verification of the order details. We may contact customers to confirm delivery information or clarify an order. If an order cannot be fulfilled, we will notify the customer and arrange any applicable payment reversal in accordance with our policies and applicable law. Customers are responsible for providing accurate names, contact numbers, delivery addresses, and other required information.</p>
      </PolicySection>
      <PolicySection heading="Product availability and stock">
        <p>All products are subject to availability. We aim to maintain accurate stock information on our website. However, an item may occasionally become unavailable due to a stock discrepancy or a technical error. If a product becomes unavailable after an order is placed, we will inform the customer and discuss the available options.</p>
      </PolicySection>
      <PolicySection heading="Shipping and delivery">
        <p>
          Aurele offers delivery across Pakistan to serviceable locations. Delivery charges, estimated delivery timelines, and other applicable shipping conditions will be communicated on our website or during checkout. Delivery timelines are estimates and may be affected by courier operations, weather, public holidays, or other circumstances beyond our reasonable control. Customers are responsible for providing a complete and accurate delivery address and remaining reachable for delivery coordination. For further details, please refer to our{" "}
          <Link href="/shipping" className="text-foreground underline">
            Shipping Policy
          </Link>
          .
        </p>
      </PolicySection>
      <PolicySection heading="Exchanges, returns and refunds">
        <p>
          Our exchange, return, and refund procedures are explained in our separate{" "}
          <Link href="/returns" className="text-foreground underline">
            Exchange and Return Policy
          </Link>
          . Customers should review that policy before placing an order. Any request must follow the applicable eligibility requirements, time limits, and return instructions stated in the policy. Nothing in these Terms of Service is intended to remove any rights or remedies available to consumers under applicable law.
        </p>
      </PolicySection>
      <PolicySection heading="Customer responsibilities">
        <p>By using our website, you agree to: provide accurate information when placing an order; use the website for lawful purposes; avoid fraudulent orders, unauthorised payment activity, or attempts to interfere with website operations; and not misuse, copy, or reproduce our website content, photographs, branding, or other protected material without permission. We reserve the right to investigate suspected misuse and take appropriate action in accordance with applicable law.</p>
      </PolicySection>
      <PolicySection heading="Website accuracy and availability">
        <p>We aim to keep our website, product listings, prices, and other information accurate and accessible. However, occasional technical errors, interruptions, or inaccuracies may occur. We may update product information, correct errors, or make changes to website features as necessary.</p>
      </PolicySection>
      <PolicySection heading="Privacy">
        <p>
          We collect and use customer information to process orders, arrange deliveries, provide customer support, and operate our business. Our handling of personal information is explained in our separate{" "}
          <Link href="/privacy" className="text-foreground underline">
            Privacy Policy
          </Link>
          , which customers should read alongside these terms.
        </p>
      </PolicySection>
      <PolicySection heading="Changes to these terms">
        <p>We may update these Terms of Service when our business practices, website features, or applicable legal requirements change. The latest version will be published on our website with its updated effective date. Changes will apply prospectively, subject to applicable law and any rights arising from an existing order.</p>
      </PolicySection>
      <PolicySection heading="Contact us">
        <p>If you have any questions about these terms, your order, or our policies, please contact us through the contact details provided on our website.</p>
        <p>Thank you for shopping with Aurele!</p>
      </PolicySection>
    </Policy>
  );
}

import type { Metadata } from "next";
import { Policy, PolicySection } from "@/components/store/policy";

export const metadata: Metadata = {
  title: "Shipping — Aurele",
  description: "How Aurele packs, processes, and delivers orders in Pakistan.",
};

export default function ShippingPage() {
  return (
    <Policy title="Shipping">
      <p className="text-muted">
        At Aurele, we ensure that your exquisite jewelry reaches you safely, securely, and on time. All orders are carefully packaged with premium protective materials to maintain the pristine condition of your purchase.
      </p>
      <PolicySection heading="Processing time">
        <p>All orders are processed within 1–2 business days of confirmation.</p>
      </PolicySection>
      <PolicySection heading="Delivery time">
        <p>In Pakistan, you can expect your order to be delivered within 3 to 5 working days for major cities after it has been dispatched. Deliveries to remote areas might require additional time. Please ensure you are available at the contact number provided for our team to reach you.</p>
        <p>For high-demand periods, festivals, or special collections, delivery may take slightly longer.</p>
      </PolicySection>
      <PolicySection heading="Order tracking">
        <p>Once your order is shipped, you will receive a tracking number to monitor your shipment.</p>
        <p>Aurele is not responsible for delays caused by courier services beyond our control.</p>
      </PolicySection>
    </Policy>
  );
}

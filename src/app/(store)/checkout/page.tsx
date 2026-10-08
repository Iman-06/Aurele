import type { Metadata } from "next";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Checkout — Aurele",
  description: "Secure checkout for your jewelry order.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return <CheckoutForm />;
}

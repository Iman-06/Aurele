"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCheckoutCart } from "@/lib/checkout/cart-adapter";
import { trackBeginCheckout, trackAddPaymentInfo, trackPurchase } from "@/lib/checkout/analytics";
import { formatRs } from "@/lib/format";
import type { CartSummary } from "@/lib/cart-types";
import type { PublicOrder } from "@/server/orders/public-order";

const STANDARD_SHIPPING_FEE = 250;

type FormErrors = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  general?: string;
};

export function CheckoutForm() {
  const router = useRouter();
  const { rawItems, orderPayload, isHydrated, isEmpty, clearCart, addDevTestItem } = useCheckoutCart();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Lahore");
  const [postalCode, setPostalCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "JAZZCASH">("COD");

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validatedCart, setValidatedCart] = useState<CartSummary | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Validate cart against backend on mount and whenever items change
  useEffect(() => {
    if (!isHydrated || rawItems.length === 0) return;

    let cancelled = false;
    setIsValidating(true);

    void (async () => {
      try {
        const res = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: rawItems.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
              price: i.priceAtAdd,
            })),
          }),
        });

        if (!res.ok) throw new Error("Cart validation failed");
        const data = (await res.json()) as CartSummary;
        if (!cancelled) {
          setValidatedCart(data);
          trackBeginCheckout(
            rawItems.map((i) => ({ variantId: i.variantId, name: i.name, quantity: i.quantity, unitPrice: i.priceAtAdd })),
            data.subtotal + STANDARD_SHIPPING_FEE,
          );
        }
      } catch (err) {
        console.warn("[checkout] Live cart validation error:", err);
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, rawItems]);

  const subtotal = useMemo(() => {
    if (validatedCart) return validatedCart.subtotal;
    return rawItems.reduce((acc, item) => acc + item.priceAtAdd * item.quantity, 0);
  }, [validatedCart, rawItems]);

  const total = subtotal + STANDARD_SHIPPING_FEE;

  // Client-side quick validation
  const validateForm = (): boolean => {
    const errs: FormErrors = {};

    if (!name.trim() || name.trim().length < 2) {
      errs.name = "Please enter your full name.";
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address.";
    }

    const cleanPhone = phone.replace(/[\s-]/g, "");
    if (!cleanPhone || !/^\+?[0-9]{10,15}$/.test(cleanPhone)) {
      errs.phone = "Please enter a valid phone number (e.g. 0321 1234567).";
    }

    if (!address.trim() || address.trim().length < 5) {
      errs.address = "Please enter your full delivery address.";
    }

    if (!city.trim() || city.trim().length < 2) {
      errs.city = "Please enter your city.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    if (orderPayload.length === 0) {
      setErrors({ general: "Your cart is empty. Please add items before checking out." });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      trackAddPaymentInfo(paymentMethod, total);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderPayload,
          customer: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            address: address.trim(),
            city: city.trim(),
            postalCode: postalCode.trim() || null,
          },
          paymentMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error?.message || "Could not place your order. Please check your details and try again.";
        setErrors({ general: errorMsg });
        setIsSubmitting(false);
        return;
      }

      const order: PublicOrder = data.order;

      // Track purchase event
      trackPurchase(order);

      // Clear the local cart
      clearCart();

      // Navigate to confirmation page
      router.push(`/order/${order.orderNumber}`);
    } catch (err) {
      console.error("[checkout] Submission error:", err);
      setErrors({
        general: "A network error occurred while placing your order. Please try again.",
      });
      setIsSubmitting(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="py-20 text-center text-sm text-muted">
        Loading checkout details…
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center space-y-6">
        <h1 className="text-xl font-light tracking-[0.2em] uppercase">Your Cart is Empty</h1>
        <p className="text-sm text-muted">You have no pieces selected for checkout.</p>
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/" className="btn btn-choose">
            Browse Collection
          </Link>
          {process.env.NODE_ENV !== "production" && (
            <button
              type="button"
              onClick={() => addDevTestItem(1, 2500)}
              className="text-xs uppercase tracking-widest text-gold underline underline-offset-4 hover:opacity-80"
            >
              + Add Sample Piece (Dev Only)
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 lg:px-12">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-lg font-light tracking-[0.3em] uppercase">Checkout</h1>
        <p className="mt-1 text-xs tracking-wider text-muted uppercase">Complete your delivery & payment</p>
      </div>

      {errors.general && (
        <div className="mb-8 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-12 lg:grid-cols-[1fr_22rem]">
        {/* Left Column: Form Fields */}
        <div className="space-y-10">
          {/* 1. Contact Information */}
          <section className="space-y-4">
            <div className="border-b border-line pb-2">
              <h2 className="text-[0.7rem] font-medium tracking-[0.22em] text-foreground uppercase">
                1. Contact Details
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-xs uppercase tracking-wider text-muted mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayesha Khan"
                  className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-xs uppercase tracking-wider text-muted mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
                />
                <p className="mt-1 text-[0.65rem] text-muted">Order confirmation will be sent here.</p>
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs uppercase tracking-wider text-muted mb-1">
                  Mobile Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0300 1234567"
                  className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
                />
                <p className="mt-1 text-[0.65rem] text-muted">Courier rider calls before delivery.</p>
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
            </div>
          </section>

          {/* 2. Shipping Address */}
          <section className="space-y-4">
            <div className="border-b border-line pb-2">
              <h2 className="text-[0.7rem] font-medium tracking-[0.22em] text-foreground uppercase">
                2. Delivery Address
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="address" className="block text-xs uppercase tracking-wider text-muted mb-1">
                  Complete Street Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="address"
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House / Apartment number, Street, Sector or Phase"
                  className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
                />
                {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="city" className="block text-xs uppercase tracking-wider text-muted mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Lahore, Karachi, Islamabad..."
                    className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
                  />
                  {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
                </div>

                <div>
                  <label htmlFor="postalCode" className="block text-xs uppercase tracking-wider text-muted mb-1">
                    Postal Code <span className="text-[0.7rem] text-muted">(Optional)</span>
                  </label>
                  <input
                    id="postalCode"
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="e.g. 54000"
                    className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Payment Method */}
          <section className="space-y-4">
            <div className="border-b border-line pb-2">
              <h2 className="text-[0.7rem] font-medium tracking-[0.22em] text-foreground uppercase">
                3. Payment Method
              </h2>
            </div>

            <div className="space-y-3">
              {/* Option 1: Cash on Delivery */}
              <label
                className={`flex cursor-pointer items-start gap-4 border p-4 transition-colors ${
                  paymentMethod === "COD" ? "border-foreground bg-surface" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="COD"
                  checked={paymentMethod === "COD"}
                  onChange={() => setPaymentMethod("COD")}
                  className="mt-1 accent-foreground"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cash on Delivery (COD)</span>
                    <span className="text-xs uppercase tracking-wider text-gold">Available</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Pay with cash when your parcel is delivered to your doorstep. Standard shipping across Pakistan.
                  </p>
                </div>
              </label>

              {/* Option 2: JazzCash (Disabled placeholder for Phase 5) */}
              <label className="flex cursor-not-allowed items-start gap-4 border border-line bg-background/50 p-4 opacity-60">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="JAZZCASH"
                  disabled
                  checked={paymentMethod === "JAZZCASH"}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted">JazzCash Online Payment</span>
                    <span className="rounded bg-line px-1.5 py-0.5 text-[0.65rem] tracking-wider text-muted uppercase">
                      Coming in Phase 5
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Pay with JazzCash Mobile Account or Debit/Credit card. (Disabled until merchant approval).
                  </p>
                </div>
              </label>
            </div>
          </section>
        </div>

        {/* Right Column: Order Summary */}
        <aside className="self-start rounded border border-line bg-surface p-6 space-y-6">
          <div className="border-b border-line pb-3">
            <h2 className="text-[0.7rem] font-medium tracking-[0.22em] text-foreground uppercase">
              Order Summary ({rawItems.length} {rawItems.length === 1 ? "item" : "items"})
            </h2>
          </div>

          {/* Item List */}
          <ul className="divide-y divide-line max-h-72 overflow-y-auto pr-1">
            {rawItems.map((item) => (
              <li key={item.variantId} className="flex justify-between py-3 text-xs">
                <div className="space-y-0.5 pr-2">
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-[0.68rem] tracking-wider text-muted uppercase">
                    {item.finish} {item.colour !== "None / Single" ? `· ${item.colour}` : ""}{" "}
                    {item.size ? `· Size ${item.size}` : ""} &times; {item.quantity}
                  </p>
                </div>
                <div className="shrink-0 tabular-nums text-foreground">
                  {formatRs(item.priceAtAdd * item.quantity)}
                </div>
              </li>
            ))}
          </ul>

          {/* Pricing Totals */}
          <div className="border-t border-line pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted text-xs">
              <span>Subtotal</span>
              <span className="tabular-nums text-foreground">{formatRs(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted text-xs">
              <span>Standard Shipping</span>
              <span className="tabular-nums text-foreground">{formatRs(STANDARD_SHIPPING_FEE)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-3 font-medium text-base">
              <span>Total Amount</span>
              <span className="tabular-nums text-foreground">{formatRs(total)}</span>
            </div>
          </div>

          {isValidating && (
            <p className="text-[0.68rem] text-muted italic">Verifying stock and prices with database…</p>
          )}

          {/* Place Order CTA Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn btn-add text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Placing your order…" : `Confirm Order · ${formatRs(total)}`}
          </button>

          <p className="text-[0.65rem] text-center text-muted tracking-wider uppercase">
            Safe &amp; contactless delivery across Pakistan
          </p>
        </aside>
      </form>
    </div>
  );
}

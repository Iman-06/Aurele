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
  const { rawItems, orderPayload, isHydrated, isEmpty, addDevTestItem } = useCheckoutCart();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Lahore");
  const [postalCode, setPostalCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "JAZZCASH">("COD");

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
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

  const linesByVariant = useMemo(
    () => new Map((validatedCart?.lines ?? []).map((l) => [l.variantId, l])),
    [validatedCart],
  );

  const hasSoldOut = useMemo(() => {
    return (validatedCart?.lines ?? []).some(
      (l) => l.problem === "OUT_OF_STOCK" || l.problem === "UNAVAILABLE",
    );
  }, [validatedCart]);

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
    if (isSubmitting || isNavigating) return;

    if (hasSoldOut) {
      setErrors({
        general: "One or more items in your cart are currently sold out. Please remove them from your bag before checking out.",
      });
      return;
    }

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
        let errorMsg = data?.error?.message || "Could not place your order. Please check your details and try again.";
        if (res.status === 409 || data?.error?.code === "OUT_OF_STOCK") {
          errorMsg = "One of the pieces in your order just sold out. No order was placed. Please return to your bag to update your selection.";
        }
        setErrors({ general: errorMsg });
        setIsSubmitting(false);
        return;
      }

      const order: PublicOrder = data.order;

      // Track purchase event
      trackPurchase(order);

      // Do NOT clear the cart state immediately here: clearing cart prematurely causes
      // the checkout UI to flash an "Empty Cart" message before router navigation completes.
      // Instead, we navigate directly to the confirmation page, which clears the cart on mount.
      setIsNavigating(true);

      const confirmationUrl = order.token
        ? `/order/${order.orderNumber}?token=${encodeURIComponent(order.token)}`
        : `/order/${order.orderNumber}`;
      router.push(confirmationUrl);
    } catch (err) {
      console.error("[checkout] Submission error:", err);
      setErrors({
        general: "A network error occurred while placing your order. Please try again.",
      });
      setIsSubmitting(false);
      setIsNavigating(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="py-20 text-center text-sm text-muted">
        Loading checkout details…
      </div>
    );
  }

  // Only show empty cart screen if the cart is truly empty and the user is NOT in the middle of
  // submitting an order or transitioning to the confirmation page.
  if (isEmpty && !isSubmitting && !isNavigating) {
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
    <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-8 lg:px-12">
      {/* Full-screen Loading Overlay during checkout processing and transition */}
      {(isSubmitting || isNavigating) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs transition-opacity duration-200">
          <div className="flex flex-col items-center gap-4 rounded border border-line bg-surface p-8 shadow-sm text-center max-w-sm mx-4">
            <svg
              className="size-8 animate-spin text-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium tracking-wider uppercase text-foreground">
                {isNavigating ? "Order Confirmed" : "Placing Your Order"}
              </p>
              <p className="text-xs text-muted">
                {isNavigating
                  ? "Redirecting to your order confirmation…"
                  : "Please wait while we secure your pieces…"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-lg font-light tracking-[0.3em] uppercase">Checkout</h1>
        <p className="mt-1 text-xs tracking-wider text-muted uppercase">Complete your delivery & payment</p>
      </div>

      {hasSoldOut && (
        <div className="mb-8 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium">One or more items in your cart are currently sold out.</p>
            <p className="text-xs text-amber-800 mt-0.5">Please remove sold-out items from your bag before placing your order.</p>
          </div>
          <Link href="/cart" className="text-xs font-semibold tracking-wider uppercase underline whitespace-nowrap hover:text-black">
            Update Shopping Bag &rarr;
          </Link>
        </div>
      )}

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
                  disabled={isSubmitting || isNavigating}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayesha Khan"
                  className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
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
                  disabled={isSubmitting || isNavigating}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
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
                  disabled={isSubmitting || isNavigating}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0300 1234567"
                  className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
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
                  disabled={isSubmitting || isNavigating}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House / Apartment number, Street, Sector or Phase"
                  className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
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
                    disabled={isSubmitting || isNavigating}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Lahore, Karachi, Islamabad..."
                    className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
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
                    disabled={isSubmitting || isNavigating}
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="e.g. 54000"
                    className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
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
              {/* Cash on Delivery */}
              <label className="flex cursor-pointer items-start gap-4 border border-foreground bg-surface p-4 transition-colors">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="COD"
                  checked={paymentMethod === "COD"}
                  onChange={() => setPaymentMethod("COD")}
                  disabled={isSubmitting || isNavigating}
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
            {rawItems.map((item) => {
              const line = linesByVariant.get(item.variantId);
              const isLineSoldOut = line?.problem === "OUT_OF_STOCK" || line?.problem === "UNAVAILABLE";

              return (
                <li key={item.variantId} className="flex justify-between py-3 text-xs">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${isLineSoldOut ? "line-through text-muted" : "text-foreground"}`}>
                        {item.name}
                      </p>
                      {isLineSoldOut && (
                        <span className="bg-neutral-900 text-white text-[0.6rem] tracking-wider uppercase px-1.5 py-0.5 font-medium">
                          Sold Out
                        </span>
                      )}
                    </div>
                    <p className="text-[0.68rem] tracking-wider text-muted uppercase">
                      {item.finish} {item.colour !== "None / Single" ? `· ${item.colour}` : ""}{" "}
                      {item.size ? `· Size ${item.size}` : ""} &times; {item.quantity}
                    </p>
                  </div>
                  <div className={`shrink-0 tabular-nums ${isLineSoldOut ? "line-through text-muted" : "text-foreground"}`}>
                    {formatRs(item.priceAtAdd * item.quantity)}
                  </div>
                </li>
              );
            })}
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
            disabled={isSubmitting || hasSoldOut || isNavigating}
            className="w-full btn btn-add text-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {(isSubmitting || isNavigating) && (
              <svg className="size-4 animate-spin text-current" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {isNavigating
              ? "Opening confirmation…"
              : isSubmitting
                ? "Placing your order…"
                : hasSoldOut
                  ? "Items Sold Out — Update Bag"
                  : `Confirm Order · ${formatRs(total)}`}
          </button>

          <p className="text-[0.65rem] text-center text-muted tracking-wider uppercase">
            Safe &amp; contactless delivery across Pakistan
          </p>
        </aside>
      </form>
    </div>
  );
}

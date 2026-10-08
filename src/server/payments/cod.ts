import type { PrismaClient } from "@/generated/prisma/client";
import { sendOrderCreatedEmails } from "@/server/email/resend";
import { DomainError } from "@/server/errors";
import { placeOrder, type PlaceOrderInput } from "@/server/orders/orders";
import { toPublicOrder } from "@/server/orders/public-order";
import type { CreatePaymentContext, CreatePaymentResult, PaymentProvider } from "./types";

/**
 * Cash on Delivery. Stock, totals, and order rows are created by Track 2 `placeOrder`.
 * Sends order confirmation emails and adapts the result for the checkout page.
 */
export const codProvider: PaymentProvider = {
  method: "COD",

  async createPayment(db: PrismaClient, input: PlaceOrderInput, ctx?: CreatePaymentContext): Promise<CreatePaymentResult> {
    if (input.paymentMethod !== "COD") {
      throw new DomainError("INVALID_INPUT", "This provider only handles Cash on Delivery");
    }

    const order = await placeOrder(db, input, { customerId: ctx?.customerId });

    // Trigger emails asynchronously — never blocks or breaks checkout
    void sendOrderCreatedEmails(order, db).catch((err) => {
      console.error("[payments:cod] Unhandled error in sendOrderCreatedEmails:", err);
    });

    return { order: toPublicOrder(order), next: { type: "CONFIRMATION" } };
  },
};

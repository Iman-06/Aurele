import type { PaymentMethod, PrismaClient } from "@/generated/prisma/client";
import type { PlaceOrderInput } from "@/server/orders/orders";
import type { PublicOrder } from "@/server/orders/public-order";

/**
 * What the checkout page should do after the server has created the order.
 * JazzCash will use REDIRECT later (hosted page). Do not invent gateway fields here.
 */
export type CheckoutNext =
  | { type: "CONFIRMATION" }
  | { type: "REDIRECT"; url: string; formFields?: Record<string, string> };

export type CreatePaymentResult = {
  order: PublicOrder;
  next: CheckoutNext;
};

export type CreatePaymentContext = {
  /** Must come from a server session — never from the request body. */
  customerId?: number;
};

/**
 * One payment method. Checkout talks to this interface, not to JazzCash/COD details.
 * Add Easypaisa / PayFast / Alfalah as extra providers without rewriting checkout.
 */
export interface PaymentProvider {
  readonly method: PaymentMethod;
  createPayment(db: PrismaClient, input: PlaceOrderInput, ctx?: CreatePaymentContext): Promise<CreatePaymentResult>;
  /** Gateway return/IPN. COD has none. JazzCash implements this in Phase 5. */
  handleCallback?(db: PrismaClient, payload: unknown): Promise<unknown>;
}

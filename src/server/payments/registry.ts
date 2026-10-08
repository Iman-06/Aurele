import type { PaymentMethod } from "@/generated/prisma/client";
import { DomainError } from "@/server/errors";
import { codProvider } from "./cod";
import { jazzCashProvider } from "./jazzcash";
import type { PaymentProvider } from "./types";

const providers: Record<PaymentMethod, PaymentProvider> = {
  COD: codProvider,
  JAZZCASH: jazzCashProvider,
};

/** Methods the checkout page may offer as selectable. JazzCash stays listed but disabled in Phase 2. */
export const CHECKOUT_ENABLED_METHODS: readonly PaymentMethod[] = ["COD"];

export function getPaymentProvider(method: string): PaymentProvider {
  const provider = providers[method as PaymentMethod];
  if (!provider) {
    throw new DomainError("INVALID_INPUT", "Please choose a valid payment method");
  }
  return provider;
}

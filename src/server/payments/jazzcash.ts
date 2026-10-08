import { DomainError } from "@/server/errors";
import type { PaymentProvider } from "./types";

/**
 * Placeholder until Phase 5. Do not add hash fields or hosted-page URLs until the
 * official JazzCash integration document and sandbox credentials are available.
 */
export const jazzCashProvider: PaymentProvider = {
  method: "JAZZCASH",

  async createPayment() {
    throw new DomainError(
      "INVALID_INPUT",
      "JazzCash is not available yet. Please choose Cash on Delivery.",
    );
  },
};

// Errors the storefront / checkout / admin can show to people.
// `code` is stable for UI logic; `message` is human-readable; `details` carries specifics.

export type DomainErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "NOT_PURCHASABLE" // hidden, sold out by owner, or not priced yet
  | "OUT_OF_STOCK"
  | "INVALID_TRANSITION" // e.g. cancelling a shipped order
  | "STOCK_CONFLICT" // stock changed while the owner was editing it
  | "AMOUNT_MISMATCH"; // JazzCash paid amount ≠ order total

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type Shortage = { variantId: number; label: string; requested: number; available: number };

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Secret used to sign order confirmation tokens.
 * Falls back to AUTH_SECRET or a deterministic server key.
 */
function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.CRON_SECRET || "aurele-order-token-fallback-key";
  return secret;
}

/**
 * Generates an unguessable cryptographic token for an order.
 * This prevents sequential order number guessing (IDOR / enumeration attacks)
 * and ensures only the customer who placed the order or received the confirmation email
 * can access the order details.
 */
export function generateOrderToken(orderNumber: string): string {
  const hmac = createHmac("sha256", getSecret());
  hmac.update(`aurele-order:${orderNumber.trim()}`);
  return hmac.digest("hex").slice(0, 32);
}

/**
 * Verifies if the provided token matches the expected unguessable token for an order.
 */
export function verifyOrderToken(orderNumber: string, token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  const expected = generateOrderToken(orderNumber);
  
  if (token.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

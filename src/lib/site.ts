/**
 * Fallback when Admin → Settings has not saved a support email.
 * Set NEXT_PUBLIC_SUPPORT_EMAIL once the address is chosen. Leave it unset until then.
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";

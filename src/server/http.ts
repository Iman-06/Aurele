import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError, type DomainErrorCode } from "./errors";

// Shared helpers for Route Handlers: consistent JSON errors for the storefront/checkout.
// Error body: { error: { code, message, details? } }

const STATUS: Record<DomainErrorCode, number> = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  NOT_PURCHASABLE: 409,
  OUT_OF_STOCK: 409,
  INVALID_TRANSITION: 409,
  STOCK_CONFLICT: 409,
  AMOUNT_MISMATCH: 409,
  TOO_MANY_REQUESTS: 429,
};

export function errorResponse(code: DomainErrorCode, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status: STATUS[code] });
}

/** Turn anything thrown in a handler into a safe JSON response (never leaks internals). */
export function handleError(e: unknown) {
  if (e instanceof DomainError) return errorResponse(e.code, e.message, e.details);
  if (e instanceof ZodError) return errorResponse("INVALID_INPUT", e.issues[0]?.message ?? "Invalid request", e.issues);
  console.error(e);
  return NextResponse.json({ error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." } }, { status: 500 });
}

const MAX_JSON_BYTES = 64 * 1024; // a full 50-line cart is a few KB

/** Parse a JSON request body (max 64 KB), or throw INVALID_INPUT. */
export async function readJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES) throw new DomainError("INVALID_INPUT", "Request is too large");
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new DomainError("INVALID_INPUT", "Request is too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("INVALID_INPUT", "Request body must be valid JSON");
  }
}

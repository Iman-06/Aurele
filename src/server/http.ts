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

/** Parse a JSON request body, or throw INVALID_INPUT. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new DomainError("INVALID_INPUT", "Request body must be valid JSON");
  }
}

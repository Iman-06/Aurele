import { NextResponse } from "next/server";

/**
 * Placeholder IPN (server-to-server webhook callback) for JazzCash.
 * Official parameter handling, HMAC hash verification, and confirmJazzCashPayment
 * transition will be implemented in Phase 5 upon receiving official documentation.
 */
export async function POST(req: Request) {
  return NextResponse.json(
    { message: "JazzCash IPN endpoint - waiting for Phase 5 specification" },
    { status: 501 },
  );
}

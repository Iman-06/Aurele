import { NextResponse } from "next/server";

/**
 * Placeholder return URL for JazzCash customer browser redirect.
 * Official parameter handling and cryptographic hash verification will be implemented
 * in Phase 5 upon receiving official documentation and sandbox credentials.
 */
export async function POST(req: Request) {
  return NextResponse.json(
    { message: "JazzCash return endpoint - waiting for Phase 5 specification" },
    { status: 501 },
  );
}

export async function GET(req: Request) {
  return NextResponse.json(
    { message: "JazzCash return endpoint - waiting for Phase 5 specification" },
    { status: 501 },
  );
}

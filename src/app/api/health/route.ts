import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health check endpoint for Railway and monitoring uptime checks.
 * Checks basic service liveness and optional database ping.
 */
export async function GET() {
  try {
    // Quick ping to verify DB connectivity
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        service: "aurele",
        timestamp: new Date().toISOString(),
        database: "connected",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[healthcheck] Database ping failed:", error);

    // Return 200 with degraded status so container is not immediately killed during brief network blips
    return NextResponse.json(
      {
        status: "degraded",
        service: "aurele",
        timestamp: new Date().toISOString(),
        database: "unreachable",
      },
      { status: 200 },
    );
  }
}

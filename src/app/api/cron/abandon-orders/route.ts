import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleError } from "@/server/http";
import { abandonUnpaidOrders } from "@/server/orders/orders";

// GET /api/cron/abandon-orders  (header: Authorization: Bearer <CRON_SECRET>)
// Run hourly by the host's scheduler (e.g. Vercel Cron). Marks JazzCash orders unpaid for 24h as ABANDONED.

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Not allowed" } }, { status: 401 });
  try {
    return NextResponse.json({ abandoned: await abandonUnpaidOrders(db) });
  } catch (e) {
    return handleError(e);
  }
}

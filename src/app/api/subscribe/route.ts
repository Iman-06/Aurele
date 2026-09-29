import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleError, readJson } from "@/server/http";
import { subscribe } from "@/server/marketing/subscribers";

// POST /api/subscribe  { email } → 200 { ok: true } (same answer if already subscribed)
export async function POST(req: Request) {
  try {
    const body = (await readJson(req)) as { email?: unknown } | null;
    await subscribe(db, body?.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

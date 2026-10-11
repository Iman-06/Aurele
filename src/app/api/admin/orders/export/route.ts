import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ordersWorkbookBuffer } from "@/server/admin/orders-export";
import { getAdmin } from "@/server/auth/admin-session";
import { DomainError } from "@/server/errors";

// GET /api/admin/orders/export?tab=&q=&method=&from=&to= → the orders matching the admin list's
// current filters as an Excel file (Orders + Items sheets). Admin only.
export async function GET(req: NextRequest) {
  if (!(await getAdmin())) return Response.json({ error: { code: "UNAUTHORIZED", message: "Not signed in" } }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const get = (k: string) => sp.get(k) ?? undefined;
  try {
    const buf = await ordersWorkbookBuffer(db, { tab: get("tab") as never, q: get("q"), method: get("method") as never, from: get("from"), to: get("to") });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="Aurele_Orders_${date}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    // The owner clicked a download link, so answer in plain words rather than JSON.
    if (e instanceof DomainError) return new Response(e.message, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
    throw e;
  }
}

import { db } from "@/lib/db";
import { getAdmin } from "@/server/auth/admin-session";
import { inventoryWorkbookBuffer } from "@/server/inventory/exporter";

// GET /api/admin/inventory/export → downloads the current inventory as an Excel file
// in the same layout as the original workbook. Admin only.
export async function GET() {
  if (!(await getAdmin())) return Response.json({ error: { code: "UNAUTHORIZED", message: "Not signed in" } }, { status: 401 });

  const now = new Date();
  const buf = await inventoryWorkbookBuffer(db, now);
  const date = now.toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="Lunara_Inventory_${date}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}

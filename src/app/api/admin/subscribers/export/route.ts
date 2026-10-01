import { db } from "@/lib/db";
import { subscribersWorkbookBuffer } from "@/server/admin/subscribers";
import { getAdmin } from "@/server/auth/admin-session";

// GET /api/admin/subscribers/export → mailing list as an Excel file. Admin only.
export async function GET() {
  if (!(await getAdmin())) return Response.json({ error: { code: "UNAUTHORIZED", message: "Not signed in" } }, { status: 401 });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(await subscribersWorkbookBuffer(db)), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="Lunara_Subscribers_${date}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}

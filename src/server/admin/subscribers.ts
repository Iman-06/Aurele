import ExcelJS from "exceljs";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "../errors";

// Mailing-list sign-ups for the admin panel (sign-up itself: src/server/marketing/subscribers.ts).

const PAGE_SIZE = 50;

export async function listSubscribers(db: PrismaClient, query: { q?: string; page?: number | string } = {}) {
  const q = query.q?.trim() || undefined;
  const page = Math.max(1, Number(query.page) || 1);
  const where = q ? { email: { contains: q, mode: "insensitive" as const } } : {};
  const [rows, total, allTime, last30] = await Promise.all([
    db.subscriber.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.subscriber.count({ where }),
    db.subscriber.count(),
    db.subscriber.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
  ]);
  return { rows, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), allTime, last30, q };
}

/** Remove someone from the list (e.g. they asked to unsubscribe). */
export async function removeSubscriber(db: PrismaClient, id: number) {
  const res = await db.subscriber.deleteMany({ where: { id } });
  if (res.count === 0) throw new DomainError("NOT_FOUND", "Subscriber not found");
}

/** All subscribers as an Excel file (Email, Signed up) — e.g. to import into an email tool. */
export async function subscribersWorkbookBuffer(db: PrismaClient): Promise<Buffer> {
  const subs = await db.subscriber.findMany({ orderBy: { createdAt: "asc" } });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Subscribers", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Email", key: "email", width: 36 },
    { header: "Signed up (PKT)", key: "date", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  for (const s of subs) ws.addRow({ email: s.email, date: fmt.format(s.createdAt).replace(",", "") });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

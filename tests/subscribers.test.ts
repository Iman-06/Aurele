import ExcelJS from "exceljs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listSubscribers, removeSubscriber, subscribersWorkbookBuffer } from "@/server/admin/subscribers";
import { DomainError } from "@/server/errors";
import { subscribe } from "@/server/marketing/subscribers";
import { resetDb, testDb as db } from "./helpers/db";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("mailing list admin", () => {
  beforeEach(async () => {
    for (const e of ["ayesha@example.com", "sara@example.com", "hina@gmail.com"]) await subscribe(db, e);
    await db.subscriber.update({ where: { email: "ayesha@example.com" }, data: { createdAt: new Date(Date.now() - 60 * 86400_000) } });
  });

  it("lists newest first with totals and search", async () => {
    const all = await listSubscribers(db);
    expect(all.rows.map((r) => r.email)).toEqual(["hina@gmail.com", "sara@example.com", "ayesha@example.com"]);
    expect([all.allTime, all.last30, all.total]).toEqual([3, 2, 3]);
    expect((await listSubscribers(db, { q: "EXAMPLE" })).rows.map((r) => r.email)).toEqual(["sara@example.com", "ayesha@example.com"]);
  });

  it("removes a subscriber (unsubscribe); unknown id is an error", async () => {
    const s = await db.subscriber.findUniqueOrThrow({ where: { email: "sara@example.com" } });
    await removeSubscriber(db, s.id);
    expect(await db.subscriber.count()).toBe(2);
    await expect(removeSubscriber(db, s.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("exports every subscriber to Excel, oldest first", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await subscribersWorkbookBuffer(db)) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Subscribers")!;
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(["Email", "Signed up (PKT)"]);
    expect([2, 3, 4].map((r) => ws.getRow(r).getCell(1).value)).toEqual(["ayesha@example.com", "sara@example.com", "hina@gmail.com"]);
    expect(String(ws.getRow(2).getCell(2).value)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});

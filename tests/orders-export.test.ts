import ExcelJS from "exceljs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminOrders, parseOrderQuery } from "@/server/admin/orders";
import { ordersWorkbook } from "@/server/admin/orders-export";
import { cancelOrder, placeOrder, updateOrderStatus } from "@/server/orders/orders";
import { ensureDefaultSettings } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";
import { createDesign } from "./helpers/fixtures";

// The export route only checks that someone is signed in; pretend the owner is.
vi.mock("@/server/auth/admin-session", () => ({ getAdmin: async () => ({ id: 1, email: "owner@test.aurele" }) }));
const { GET: exportRoute } = await import("@/app/api/admin/orders/export/route");

const OWNER = "owner@test.aurele";
let gold: number;
let ring: number;

/** Place a COD order, then move its placed-time to a given moment (UTC ISO string). */
async function orderAt(iso: string, name: string, items = [{ variantId: gold, quantity: 1 }]) {
  const o = await placeOrder(db, {
    items,
    customer: { name, email: `${name.split(" ")[0].toLowerCase()}@example.com`, phone: "0300-1234567", address: "House 12, Street 4", city: "Lahore" },
    paymentMethod: "COD",
  });
  await db.order.update({ where: { id: o.id }, data: { createdAt: new Date(iso) } });
  return o;
}
const names = async (q: Parameters<typeof listAdminOrders>[1]) => (await listAdminOrders(db, q)).orders.map((o) => o.customerName).sort();

beforeEach(async () => {
  await resetDb();
  await ensureDefaultSettings(db);
  gold = (await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", colour: "Blue", qty: 50, price: 2500 }] })).variants[0].id;
  ring = (await createDesign({ name: "Caroline", category: "RINGS", variants: [{ finish: "SILVER", size: "8", qty: 50, price: 3000 }] })).variants[0].id;
  await db.variant.update({ where: { id: gold }, data: { costPrice: 1000 } }); // ring has no cost price
});
afterAll(() => db.$disconnect());

describe("order date filter (Pakistan days)", () => {
  it("uses Pakistan calendar days, inclusive at both ends", async () => {
    await orderAt("2026-09-30T18:59:00Z", "Before Start"); // 30 Sep 23:59 PKT
    await orderAt("2026-09-30T19:00:00Z", "Start Day"); //    1 Oct 00:00 PKT
    await orderAt("2026-10-05T18:59:00Z", "End Day"); //      5 Oct 23:59 PKT
    await orderAt("2026-10-05T19:00:00Z", "After End"); //    6 Oct 00:00 PKT

    expect(await names({ tab: "all", from: "2026-10-01", to: "2026-10-05" })).toEqual(["End Day", "Start Day"]);
    expect(await names({ tab: "all", from: "2026-10-06" })).toEqual(["After End"]);
    expect(await names({ tab: "all", to: "2026-09-30" })).toEqual(["Before Start"]);
    expect(await names({ tab: "all", from: "2026-10-05", to: "2026-10-01" })).toEqual(["End Day", "Start Day"]); // reversed → swapped
  });

  it("ignores impossible or garbage dates instead of failing", async () => {
    await orderAt("2026-10-01T10:00:00Z", "Someone");
    for (const bad of ["2026-02-31", "2026-13-01", "yesterday", "2026-1-1"]) {
      expect(parseOrderQuery({ from: bad }).from).toBeUndefined();
      expect(await names({ tab: "all", from: bad })).toEqual(["Someone"]);
    }
  });

  it("works together with the tabs, search and tab counts", async () => {
    const a = await orderAt("2026-10-02T10:00:00Z", "Ayesha Khan");
    await orderAt("2026-10-02T11:00:00Z", "Hina Malik");
    await orderAt("2026-09-01T10:00:00Z", "Old Order");
    await updateOrderStatus(db, { orderId: a.id, status: "PROCESSING" }, OWNER);

    const r = await listAdminOrders(db, { tab: "action", from: "2026-10-01", to: "2026-10-31" });
    expect(r.orders.map((o) => o.customerName)).toEqual(["Hina Malik"]);
    expect(r.counts).toMatchObject({ action: 1, processing: 1, all: 2 }); // Old Order is outside the dates
    expect(await names({ tab: "all", q: "hina", from: "2026-10-01" })).toEqual(["Hina Malik"]);
  });
});

describe("orders Excel export", () => {
  it("exports exactly the filtered orders: one row per order, one row per item", async () => {
    await orderAt("2026-10-02T10:00:00Z", "Ayesha Khan", [
      { variantId: gold, quantity: 2 },
      { variantId: ring, quantity: 1 },
    ]);
    const b = await orderAt("2026-10-03T10:00:00Z", "Hina Malik");
    await orderAt("2026-09-01T10:00:00Z", "Old Order");
    await cancelOrder(db, { orderId: b.id, reason: "Customer changed mind" }, OWNER);

    const { wb, count } = await ordersWorkbook(db, { tab: "all", from: "2026-10-01", to: "2026-10-31" });
    expect(count).toBe(2);
    expect(wb.creator).toBe("Aurele admin");

    const rows = (name: string) => {
      const ws = wb.getWorksheet(name)!;
      const header = (ws.getRow(1).values as unknown[]).slice(1) as string[];
      return Array.from({ length: ws.rowCount - 1 }, (_, i) => {
        const v = (ws.getRow(i + 2).values as unknown[]).slice(1);
        return Object.fromEntries(header.map((h, j) => [h, v[j] ?? ""]));
      });
    };

    const orders = rows("Orders");
    expect(orders.map((o) => o.Customer)).toEqual(["Ayesha Khan", "Hina Malik"]); // oldest first
    expect(orders[0]).toMatchObject({
      "Date (PKT)": "2026-10-02 15:00",
      Status: "New",
      Payment: "COD",
      "Payment status": "Unpaid",
      Phone: "0300-1234567",
      City: "Lahore",
      Items: "2 × Aveline – Gold / Blue; 1 × Caroline – Silver / 8",
      Pieces: 3,
      "Subtotal (Rs)": 8000,
      "Shipping (Rs)": 250,
      "Total (Rs)": 8250,
    });
    expect(orders[1]).toMatchObject({ Status: "Cancelled", "Cancel reason": "Customer changed mind" });

    const items = rows("Items");
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ Product: "Aveline", Finish: "Gold", Colour: "Blue", Qty: 2, "Price each (Rs)": 2500, "Line total (Rs)": 5000, "Cost each (Rs)": 1000, "Profit (Rs)": 3000 });
    expect(items[1]).toMatchObject({ Product: "Caroline", Finish: "Silver", Colour: "", Size: "8", "Cost each (Rs)": "", "Profit (Rs)": "" }); // no cost → blank, not 0
  });

  it("the download route uses the list's filters and the Aurele filename", async () => {
    await orderAt("2026-10-02T10:00:00Z", "Ayesha Khan");
    await orderAt("2026-09-01T10:00:00Z", "Old Order");
    const { NextRequest } = await import("next/server");
    const res = await exportRoute(new NextRequest("http://localhost/api/admin/orders/export?tab=all&from=2026-10-01"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="Aurele_Orders_\d{4}-\d{2}-\d{2}\.xlsx"$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    expect(wb.getWorksheet("Orders")!.rowCount).toBe(2); // header + Ayesha only
  });
});

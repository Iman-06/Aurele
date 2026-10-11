import ExcelJS from "exceljs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE } from "@/server/auth/session-token";
import { resetDb, testDb as db } from "./helpers/db";

// The export routes only check that someone is signed in; pretend the owner is.
vi.mock("@/server/auth/admin-session", () => ({ getAdmin: async () => ({ id: 1, email: "owner@test.aurele" }) }));

const { GET: exportInventory } = await import("@/app/api/admin/inventory/export/route");
const { GET: exportSubscribers } = await import("@/app/api/admin/subscribers/export/route");

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("Aurele branding", () => {
  it("names the inventory download Aurele_Inventory_<date>.xlsx and sets the creator", async () => {
    const res = await exportInventory();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="Aurele_Inventory_\d{4}-\d{2}-\d{2}\.xlsx"$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    expect(wb.creator).toBe("Aurele admin");
  });

  it("names the subscribers download Aurele_Subscribers_<date>.xlsx", async () => {
    const res = await exportSubscribers();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="Aurele_Subscribers_\d{4}-\d{2}-\d{2}\.xlsx"$/);
  });

  it("uses the aurele_admin login cookie", () => {
    expect(ADMIN_COOKIE).toBe("aurele_admin");
  });
});

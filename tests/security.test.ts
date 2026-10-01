import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sweepExpired } from "@/server/admin/excel-import";
import { authenticateAdmin, revokeAllSessions, upsertAdmin } from "@/server/auth/admin-accounts";
import { signAdminSession } from "@/server/auth/session-token";
import { validateCart } from "@/server/catalog/catalog";
import { DomainError } from "@/server/errors";
import { readJson } from "@/server/http";
import { MAX_ORDERS_PER_HOUR, placeOrder } from "@/server/orders/orders";
import { ensureDefaultSettings } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";
import { createDesign } from "./helpers/fixtures";

const customer = (phone = "0300-1234567", email = "buyer@example.com") => ({ name: "Test Buyer", email, phone, address: "1 Test Street", city: "Lahore" });

async function errorOf(p: Promise<unknown>) {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  return e as DomainError;
}

let importDir: string;
beforeAll(async () => {
  importDir = await mkdtemp(path.join(os.tmpdir(), "lunara-sec-"));
  process.env.IMPORT_DIR = importDir;
});
afterAll(async () => {
  await rm(importDir, { recursive: true, force: true });
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  await ensureDefaultSettings(db);
});

describe("orders can't be abused", () => {
  it("the 20-per-item cap also applies when the same item is repeated in the cart", async () => {
    const v = (await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", qty: 100 }] })).variants[0];
    const e = await errorOf(placeOrder(db, { items: [{ variantId: v.id, quantity: 15 }, { variantId: v.id, quantity: 10 }], customer: customer(), paymentMethod: "COD" }));
    expect(e.code).toBe("INVALID_INPUT");
    expect((await db.variant.findUniqueOrThrow({ where: { id: v.id } })).quantity).toBe(100);
  });

  it(`max ${MAX_ORDERS_PER_HOUR} orders per hour per phone (any format) or email`, async () => {
    const v = (await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", qty: 100 }] })).variants[0];
    const phones = ["0300-1234567", "+92 300 1234567", "03001234567", "0300 123 4567", "923001234567"];
    for (const p of phones) await placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer: customer(p, `x${p.length}${Math.random()}@example.com`), paymentMethod: "COD" });

    const e = await errorOf(placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer: customer("0300-1234567", "new@example.com"), paymentMethod: "COD" }));
    expect(e.code).toBe("TOO_MANY_REQUESTS");
    // a different customer is unaffected
    await placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer: customer("0321-7654321", "other@example.com"), paymentMethod: "COD" });
    // same email, different phone is also limited
    for (let i = 0; i < 4; i++) await placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer: customer(`0333-00000${10 + i}`, "other@example.com"), paymentMethod: "COD" });
    expect((await errorOf(placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer: customer("0345-9999999", "OTHER@example.com"), paymentMethod: "COD" }))).code).toBe("TOO_MANY_REQUESTS");
    // orders older than an hour don't count
    await db.order.updateMany({ data: { createdAt: new Date(Date.now() - 2 * 3600_000) } });
    await placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer: customer(), paymentMethod: "COD" });
  });

  it("a customerId in the request body is ignored — only the server can link an account", async () => {
    const v = (await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", qty: 5 }] })).variants[0];
    const victim = await db.customer.create({ data: { email: "victim@example.com" } });
    const forged = await placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer: customer(), paymentMethod: "COD", customerId: victim.id } as never);
    expect(forged.customerId).toBeNull();
    const real = await placeOrder(db, { items: [{ variantId: v.id, quantity: 1 }], customer: customer("0321-1111111", "v@example.com"), paymentMethod: "COD" }, { customerId: victim.id });
    expect(real.customerId).toBe(victim.id);
  });

  it("exact stock is only revealed at or below the low-stock limit", async () => {
    const d = await createDesign({ name: "Aveline", variants: [{ finish: "GOLD", colour: "Blue", qty: 15 }, { finish: "GOLD", colour: "Green", qty: 2 }] });
    // 15 in stock, customer asks for 20 → must not learn the real number
    const probe = await errorOf(placeOrder(db, { items: [{ variantId: d.variants[0].id, quantity: 20 }], customer: customer("0321-4444444", "b4@example.com"), paymentMethod: "COD" }));
    expect(probe.message).toBe("Not enough stock of Aveline — Gold, Blue — please choose a smaller quantity");
    expect(probe.message).not.toMatch(/15/);
    expect(JSON.stringify(probe.details)).not.toMatch(/"available":15/);

    const low = await errorOf(placeOrder(db, { items: [{ variantId: d.variants[1].id, quantity: 3 }], customer: customer("0321-5555555", "b5@example.com"), paymentMethod: "COD" }));
    expect(low.message).toBe("Only 2 left of Aveline — Gold, Green");
  });

  it("hidden or unreleased items never reveal their names", async () => {
    const d = await createDesign({ name: "Secret Collection", active: false, variants: [{ finish: "GOLD", qty: 5 }] });
    const e = await errorOf(placeOrder(db, { items: [{ variantId: d.variants[0].id, quantity: 1 }], customer: customer(), paymentMethod: "COD" }));
    expect(e.code).toBe("NOT_PURCHASABLE");
    expect(JSON.stringify([e.message, e.details])).not.toMatch(/Secret/);
    const cart = await validateCart(db, { items: [{ variantId: d.variants[0].id, quantity: 1 }] });
    expect(cart.lines[0]).toMatchObject({ name: "Item no longer available", label: "Item no longer available", slug: null, problem: "UNAVAILABLE" });
  });
});

describe("login can't be brute-forced in parallel", () => {
  it("12 wrong guesses at the same moment still lock the account; the right password is then refused", async () => {
    await upsertAdmin(db, { email: "owner@test.lunara", password: "right-password-123" });
    await Promise.all(Array.from({ length: 12 }, () => authenticateAdmin(db, { email: "owner@test.lunara", password: "wrong-guess" })));
    const after = await authenticateAdmin(db, { email: "owner@test.lunara", password: "right-password-123" });
    expect(after).toMatchObject({ ok: false, reason: "LOCKED" });
  });

  it("sign out everywhere bumps the session version", async () => {
    const { admin } = await upsertAdmin(db, { email: "owner@test.lunara", password: "right-password-123" });
    await revokeAllSessions(db, admin.id);
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })).sessionVersion).toBe(admin.sessionVersion + 1);
  });

  it("the .env.example placeholder secret is refused", async () => {
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "CHANGE_ME_TO_A_LONG_RANDOM_STRING";
    await expect(signAdminSession({ adminId: 1, sv: 1 })).rejects.toThrow(/placeholder/);
    process.env.AUTH_SECRET = original;
  });
});

describe("request and upload limits", () => {
  it("rejects oversized or broken JSON bodies", async () => {
    const big = new Request("http://x/api", { method: "POST", body: JSON.stringify({ pad: "x".repeat(70_000) }) });
    expect((await errorOf(readJson(big))).message).toBe("Request is too large");
    const lying = new Request("http://x/api", { method: "POST", body: "{}", headers: { "content-length": "999999" } });
    expect((await errorOf(readJson(lying))).message).toBe("Request is too large");
    expect(await readJson(new Request("http://x/api", { method: "POST", body: '{"a":1}' }))).toEqual({ a: 1 });
  });

  it("abandoned Excel uploads are cleaned up after 2 hours", async () => {
    const old = path.join(importDir, "11111111-1111-1111-1111-111111111111.xlsx");
    const fresh = path.join(importDir, "22222222-2222-2222-2222-222222222222.xlsx");
    await writeFile(old, "x");
    await writeFile(fresh, "x");
    const threeHoursAgo = new Date(Date.now() - 3 * 3600_000);
    await utimes(old, threeHoursAgo, threeHoursAgo);
    await sweepExpired();
    expect(await readdir(importDir)).toEqual(["22222222-2222-2222-2222-222222222222.xlsx"]);
  });
});

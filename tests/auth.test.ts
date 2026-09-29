import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { authenticateAdmin, upsertAdmin } from "@/server/auth/admin-accounts";
import { signAdminSession, verifyAdminSession } from "@/server/auth/session-token";
import { DomainError } from "@/server/errors";
import { resetDb, testDb as db } from "./helpers/db";

const EMAIL = "owner@test.lunara";
const PASSWORD = "test-password-123"; // test-only value

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("admin accounts", () => {
  it("creates an admin with a hashed password and normalised email", async () => {
    const { admin, created } = await upsertAdmin(db, { email: "  Owner@Test.Lunara ", password: PASSWORD, name: "Owner" });
    expect(created).toBe(true);
    expect(admin.email).toBe(EMAIL);
    expect(admin.passwordHash).not.toContain(PASSWORD);
    expect(admin.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
  });

  it("enforces a minimum password strength and a valid email", async () => {
    for (const [email, password] of [[EMAIL, "short1"], [EMAIL, "onlyletterslong"], [EMAIL, "1234567890123"], ["not-an-email", PASSWORD]]) {
      const err = await upsertAdmin(db, { email, password }).catch((e) => e);
      expect(err).toBeInstanceOf(DomainError);
    }
    expect(await db.adminUser.count()).toBe(0);
  });

  it("running it again for the same email resets the password and signs out all devices", async () => {
    const first = (await upsertAdmin(db, { email: EMAIL, password: PASSWORD })).admin;
    const second = await upsertAdmin(db, { email: EMAIL, password: "another-pass-456" });
    expect(second.created).toBe(false);
    expect(second.admin.sessionVersion).toBe(first.sessionVersion + 1);
    expect((await authenticateAdmin(db, { email: EMAIL, password: PASSWORD })).ok).toBe(false);
    expect((await authenticateAdmin(db, { email: EMAIL, password: "another-pass-456" })).ok).toBe(true);
  });
});

describe("admin login", () => {
  beforeEach(() => upsertAdmin(db, { email: EMAIL, password: PASSWORD }));

  it("accepts the right password (email is case-insensitive) and records the login time", async () => {
    const r = await authenticateAdmin(db, { email: "OWNER@test.lunara", password: PASSWORD });
    expect(r.ok).toBe(true);
    expect((await db.adminUser.findUniqueOrThrow({ where: { email: EMAIL } })).lastLoginAt).not.toBeNull();
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    expect(await authenticateAdmin(db, { email: EMAIL, password: "wrong-password-1" })).toEqual({ ok: false, reason: "INVALID" });
    expect(await authenticateAdmin(db, { email: "nobody@test.lunara", password: PASSWORD })).toEqual({ ok: false, reason: "INVALID" });
  });

  it("locks the account for 15 minutes after 5 wrong passwords — even the right password is refused", async () => {
    const t0 = new Date("2026-10-01T10:00:00Z");
    for (let i = 1; i <= 4; i++) {
      expect((await authenticateAdmin(db, { email: EMAIL, password: "wrong" }, t0)).ok).toBe(false);
    }
    expect(await authenticateAdmin(db, { email: EMAIL, password: "wrong" }, t0)).toEqual({ ok: false, reason: "LOCKED", minutesLeft: 15 });

    const t10 = new Date(t0.getTime() + 10 * 60_000);
    expect(await authenticateAdmin(db, { email: EMAIL, password: PASSWORD }, t10)).toEqual({ ok: false, reason: "LOCKED", minutesLeft: 5 });

    const t16 = new Date(t0.getTime() + 16 * 60_000);
    expect((await authenticateAdmin(db, { email: EMAIL, password: PASSWORD }, t16)).ok).toBe(true);
  });

  it("a successful login resets the wrong-password count", async () => {
    for (let i = 0; i < 4; i++) await authenticateAdmin(db, { email: EMAIL, password: "wrong" });
    expect((await authenticateAdmin(db, { email: EMAIL, password: PASSWORD })).ok).toBe(true);
    for (let i = 0; i < 4; i++) await authenticateAdmin(db, { email: EMAIL, password: "wrong" });
    expect((await authenticateAdmin(db, { email: EMAIL, password: PASSWORD })).ok).toBe(true); // not locked
  });

  it("after a lock expires, the count starts fresh", async () => {
    const t0 = new Date("2026-10-01T10:00:00Z");
    for (let i = 0; i < 5; i++) await authenticateAdmin(db, { email: EMAIL, password: "wrong" }, t0);
    const later = new Date(t0.getTime() + 20 * 60_000);
    expect(await authenticateAdmin(db, { email: EMAIL, password: "wrong" }, later)).toEqual({ ok: false, reason: "INVALID" });
  });
});

describe("session cookie token", () => {
  it("round-trips the admin id and session version", async () => {
    const token = await signAdminSession({ adminId: 7, sv: 3 });
    expect(await verifyAdminSession(token)).toEqual({ adminId: 7, sv: 3 });
  });

  it("rejects missing, tampered and garbage tokens", async () => {
    const token = await signAdminSession({ adminId: 7, sv: 3 });
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "1", sv: 3, aud: "lunara-admin", exp: 9999999999 })).toString("base64url");
    expect(await verifyAdminSession(undefined)).toBeNull();
    expect(await verifyAdminSession("")).toBeNull();
    expect(await verifyAdminSession("not.a.token")).toBeNull();
    expect(await verifyAdminSession(`${h}.${forgedPayload}.${s}`)).toBeNull();
    expect(await verifyAdminSession(`${h}.${p}.${s.slice(0, -2)}xx`)).toBeNull();
  });

  it("expires after 7 days", async () => {
    const t0 = new Date("2026-10-01T10:00:00Z");
    const token = await signAdminSession({ adminId: 1, sv: 1 }, t0);
    expect(await verifyAdminSession(token, new Date(t0.getTime() + 6 * 86400_000))).not.toBeNull();
    expect(await verifyAdminSession(token, new Date(t0.getTime() + 8 * 86400_000))).toBeNull();
  });

  it("a token signed with a different secret is rejected", async () => {
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "a-completely-different-secret-that-is-long-enough";
    const foreign = await signAdminSession({ adminId: 1, sv: 1 });
    process.env.AUTH_SECRET = original;
    expect(await verifyAdminSession(foreign)).toBeNull();
  });
});

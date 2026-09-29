import bcrypt from "bcryptjs";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "../errors";

// Owner/staff accounts for the admin panel. No Next.js imports here so this is
// usable from scripts and tests as well as from the app.

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 10;
const BCRYPT_COST = 12;

// Compared against when the email doesn't exist, so a wrong email takes as long as a
// wrong password and attackers can't discover which emails are real.
const DUMMY_HASH = bcrypt.hashSync("lunara-dummy-password-for-timing", BCRYPT_COST);

export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Password must contain letters and numbers";
  return null;
}

const normaliseEmail = (email: string) => email.trim().toLowerCase();

/** Create an admin, or reset the password if the email already exists (logs out all their devices). */
export async function upsertAdmin(db: PrismaClient, input: { email: string; password: string; name?: string }) {
  const email = normaliseEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError("INVALID_INPUT", "Please enter a valid email");
  const problem = validateNewPassword(input.password);
  if (problem) throw new DomainError("INVALID_INPUT", problem);

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const existing = await db.adminUser.findUnique({ where: { email } });
  if (existing) {
    const updated = await db.adminUser.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        name: input.name ?? existing.name,
        failedLoginCount: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });
    return { admin: updated, created: false };
  }
  const admin = await db.adminUser.create({ data: { email, passwordHash, name: input.name ?? null } });
  return { admin, created: true };
}

export type LoginResult =
  | { ok: true; admin: { id: number; email: string; name: string | null; sessionVersion: number } }
  | { ok: false; reason: "INVALID" }
  | { ok: false; reason: "LOCKED"; minutesLeft: number };

export async function authenticateAdmin(
  db: PrismaClient,
  input: { email: string; password: string },
  now = new Date(),
): Promise<LoginResult> {
  const email = normaliseEmail(input.email);
  const admin = await db.adminUser.findUnique({ where: { email } });

  if (!admin) {
    await bcrypt.compare(input.password, DUMMY_HASH);
    return { ok: false, reason: "INVALID" };
  }

  if (admin.lockedUntil && admin.lockedUntil > now) {
    return { ok: false, reason: "LOCKED", minutesLeft: Math.ceil((admin.lockedUntil.getTime() - now.getTime()) / 60_000) };
  }

  const valid = await bcrypt.compare(input.password, admin.passwordHash);
  if (!valid) {
    // A lock that has run out starts a fresh count.
    const previous = admin.lockedUntil ? 0 : admin.failedLoginCount;
    const failed = previous + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.adminUser.update({
      where: { id: admin.id },
      data: {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    if (lock) return { ok: false, reason: "LOCKED", minutesLeft: LOCKOUT_MINUTES };
    return { ok: false, reason: "INVALID" };
  }

  await db.adminUser.update({
    where: { id: admin.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
  });
  return { ok: true, admin: { id: admin.id, email: admin.email, name: admin.name, sessionVersion: admin.sessionVersion } };
}

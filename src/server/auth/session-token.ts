import { SignJWT, jwtVerify } from "jose";

// Signed (tamper-proof) admin session token stored in an HttpOnly cookie.
// No Next.js imports: used by proxy.ts, server code and tests.

export const ADMIN_COOKIE = "lunara_admin";
export const SESSION_DAYS = 7;

export type AdminSessionPayload = { adminId: number; sv: number }; // sv = sessionVersion

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("CHANGE_ME")) {
    throw new Error("AUTH_SECRET must be set to a random value of at least 32 characters (not the .env.example placeholder)");
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminSession(payload: AdminSessionPayload, now = new Date()) {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sv: payload.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.adminId))
    .setAudience("lunara-admin")
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_DAYS * 24 * 3600)
    .sign(key());
}

/** Returns the payload, or null if missing, expired, tampered with or signed with another secret. */
export async function verifyAdminSession(token: string | undefined, now = new Date()): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      audience: "lunara-admin",
      currentDate: now,
    });
    const adminId = Number(payload.sub);
    const sv = Number(payload.sv);
    if (!Number.isInteger(adminId) || !Number.isInteger(sv)) return null;
    return { adminId, sv };
  } catch {
    return null;
  }
}

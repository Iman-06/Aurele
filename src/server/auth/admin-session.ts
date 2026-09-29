import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, SESSION_DAYS, signAdminSession, verifyAdminSession } from "./session-token";

// The real (secure) admin check — every admin page, Server Action and API route calls one of these.
// proxy.ts only does a quick cookie check for fast redirects; this one also checks the database,
// so a deleted account or a reset password logs the session out immediately.

export type AdminIdentity = { id: number; email: string; name: string | null };

export async function startAdminSession(admin: { id: number; sessionVersion: number }) {
  const token = await signAdminSession({ adminId: admin.id, sv: admin.sessionVersion });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** The signed-in admin, or null. Cached per request. */
export const getAdmin = cache(async (): Promise<AdminIdentity | null> => {
  const payload = await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!payload) return null;
  const admin = await db.adminUser.findUnique({
    where: { id: payload.adminId },
    select: { id: true, email: true, name: true, sessionVersion: true },
  });
  if (!admin || admin.sessionVersion !== payload.sv) return null;
  return { id: admin.id, email: admin.email, name: admin.name };
});

/** For admin pages and Server Actions: the signed-in admin, or redirect to the login page. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

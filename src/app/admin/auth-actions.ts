"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authenticateAdmin, revokeAllSessions } from "@/server/auth/admin-accounts";
import { endAdminSession, requireAdmin, startAdminSession } from "@/server/auth/admin-session";

export type LoginState = { error?: string; email?: string } | undefined;

/** Only allow redirecting back into the admin area (never to another site). */
function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  if (!n.startsWith("/admin") || n.startsWith("//") || n.startsWith("/admin/login")) return "/admin";
  return n;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password.", email };

  const result = await authenticateAdmin(db, { email, password });
  if (!result.ok) {
    if (result.reason === "LOCKED") {
      return {
        error: `Too many wrong attempts. Please try again in ${result.minutesLeft} minute${result.minutesLeft === 1 ? "" : "s"}.`,
        email,
      };
    }
    return { error: "Email or password is incorrect.", email };
  }

  await startAdminSession(result.admin);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await endAdminSession();
  redirect("/admin/login");
}

/** Sign out on every device (e.g. a phone was lost) — all existing login cookies stop working. */
export async function logoutEverywhere() {
  const admin = await requireAdmin();
  await revokeAllSessions(db, admin.id);
  await endAdminSession();
  redirect("/admin/login");
}

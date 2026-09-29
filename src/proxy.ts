import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/server/auth/session-token";

// Quick first gate for the admin area: no valid signed cookie → login page (or 401 for APIs).
// This is only an optimistic check (no database). Every admin page/action/API also calls
// requireAdmin()/getAdmin() from src/server/auth/admin-session.ts, which is the real check.

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);

  if (pathname.startsWith("/api/admin")) {
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.next();
  }

  // The login page itself decides (with a database check) whether to skip ahead to /admin.
  // Redirecting here on the cookie alone could loop if the session was revoked.
  if (pathname === "/admin/login") return NextResponse.next();

  if (!session) {
    const login = new URL("/admin/login", req.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};

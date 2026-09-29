import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/server/auth/admin-session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Lunara Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getAdmin()) redirect("/admin");
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl tracking-wide text-stone-900">Lunara</h1>
          <p className="mt-1 text-sm text-stone-500">Admin sign in</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <LoginForm next={typeof next === "string" ? next : "/admin"} />
        </div>
      </div>
    </main>
  );
}

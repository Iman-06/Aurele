import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/store/brand-mark";
import { BRAND_NAME } from "@/lib/storefront";
import { getAdmin } from "@/server/auth/admin-session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: `Sign in · ${BRAND_NAME} Admin`,
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getAdmin()) redirect("/admin");
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Wordmark variant="dark" crop="word" className="h-10" />
          <h1 className="sr-only">{BRAND_NAME}</h1>
          <p className="mt-3 text-sm text-[#6b6b6b]">Admin sign in</p>
        </div>
        <div className="border border-[#e6e6e6] bg-white p-6">
          <LoginForm next={typeof next === "string" ? next : "/admin"} />
        </div>
      </div>
    </main>
  );
}

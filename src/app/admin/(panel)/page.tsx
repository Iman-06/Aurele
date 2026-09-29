import { requireAdmin } from "@/server/auth/admin-session";

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome{admin.name ? `, ${admin.name}` : ""}</h1>
      <p className="mt-2 text-stone-600">
        Products, inventory and orders will appear here as they are built.
      </p>
    </div>
  );
}

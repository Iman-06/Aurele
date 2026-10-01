import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { btnDanger, card, input, label } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth/admin-session";
import { getNumberSetting } from "@/server/settings";
import { logoutEverywhere } from "../../auth-actions";
import { saveSettingsAction } from "../inventory/actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const shippingFee = await getNumberSetting(db, "shipping_fee");
  const lowStock = await getNumberSetting(db, "low_stock_threshold");

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className={card}>
        <ActionForm action={saveSettingsAction} resetKey={`${shippingFee}-${lowStock}`} className="space-y-4">
          <label className="block space-y-1">
            <span className={label}>Shipping fee (Rs, anywhere in Pakistan)</span>
            <input name="shipping_fee" defaultValue={shippingFee} inputMode="decimal" required className={`${input} w-40`} />
          </label>
          <label className="block space-y-1">
            <span className={label}>Low-stock limit</span>
            <input name="low_stock_threshold" defaultValue={lowStock} inputMode="numeric" required className={`${input} w-24`} />
            <span className="block text-xs text-stone-500">
              When a colour/size has this many or fewer left, customers see “Only N left” and it shows as Low stock here.
            </span>
          </label>
        </ActionForm>
      </section>
      <section className={card}>
        <h2 className="font-semibold">Security</h2>
        <p className="mb-3 text-sm text-stone-600">Lost a phone or signed in on someone else&apos;s computer? This signs you out on every device. You&apos;ll need to sign in again here.</p>
        <form action={logoutEverywhere}>
          <ConfirmButton message="Sign out on every device?" className={btnDanger}>
            Sign out everywhere
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}

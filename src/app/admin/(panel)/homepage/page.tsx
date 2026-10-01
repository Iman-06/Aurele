import Image from "next/image";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { badge, btnDanger, card, input, label } from "@/components/admin/ui";
import type { Promotion } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth/admin-session";
import { getBanner, listPromotions, type PromotionState } from "@/server/content/homepage";
import { createPromotionAction, deletePromotionAction, saveBannerAction, updatePromotionAction } from "./actions";

export const metadata = { title: "Homepage" };

const STATE: Record<PromotionState, [string, string]> = {
  LIVE: ["Live now", "bg-emerald-50 text-emerald-700"],
  SCHEDULED: ["Scheduled", "bg-sky-50 text-sky-700"],
  OFF: ["Switched off", "bg-stone-100 text-stone-600"],
  ENDED: ["Ended", "bg-stone-100 text-stone-500"],
};

/** Date → "2026-10-15T09:00" in Pakistan time, for <input type="datetime-local">. */
const pktInput = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" }).format(d).replace(" ", "T") : "";
const pktText = (d: Date) => new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(d);

export default async function HomepageContentPage() {
  await requireAdmin();
  const [banner, promotions] = await Promise.all([getBanner(db), listPromotions(db)]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Homepage</h1>
        <p className="text-sm text-stone-500">The main banner and the promotion strip on the website&apos;s home page. Changes appear immediately.</p>
      </div>

      {/* ---------------- Banner ---------------- */}
      <section className={card}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Main banner</h2>
          {banner?.isActive && banner.imageUrl ? (
            <span className={`${badge} bg-emerald-50 text-emerald-700`}>Live</span>
          ) : (
            <span className={`${badge} bg-stone-100 text-stone-600`}>Not showing</span>
          )}
        </div>

        {banner?.imageUrl && (
          <div className="relative mb-5 aspect-[16/6] overflow-hidden rounded-lg bg-stone-100">
            <Image src={banner.imageUrl} alt="" fill sizes="(max-width: 1024px) 100vw, 900px" className="object-cover" unoptimized />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/50 to-transparent p-5 text-white">
              {banner.heading && <p className="font-serif text-2xl">{banner.heading}</p>}
              {banner.subheading && <p className="text-sm opacity-90">{banner.subheading}</p>}
              {banner.buttonText && <span className="mt-2 w-fit rounded bg-white px-3 py-1 text-sm text-stone-900">{banner.buttonText}</span>}
            </div>
          </div>
        )}
        <p className="mb-4 text-xs text-stone-500">Preview only — the storefront team designs how it finally looks.</p>

        <ActionForm action={saveBannerAction} resetKey={banner?.updatedAt.getTime() ?? 0} submitLabel="Save banner" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className={label}>{banner?.imageUrl ? "Replace photo (wide)" : "Photo (wide, e.g. 1920×720)"}</span>
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
            </label>
            <label className="block space-y-1">
              <span className={label}>Phone photo (optional, tall)</span>
              <input name="mobileImage" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
              {banner?.mobileImageUrl && (
                <span className="flex items-center gap-2 text-xs text-stone-600">
                  <input type="checkbox" name="removeMobileImage" /> Remove the current phone photo
                </span>
              )}
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className={label}>Heading</span>
              <input name="heading" defaultValue={banner?.heading ?? ""} maxLength={80} placeholder="e.g. The Eid Edit" className={input} />
            </label>
            <label className="block space-y-1">
              <span className={label}>Subheading</span>
              <input name="subheading" defaultValue={banner?.subheading ?? ""} maxLength={200} placeholder="e.g. Pearls and gold for every celebration" className={input} />
            </label>
            <label className="block space-y-1">
              <span className={label}>Button text (optional)</span>
              <input name="buttonText" defaultValue={banner?.buttonText ?? ""} maxLength={30} placeholder="e.g. Shop now" className={input} />
            </label>
            <label className="block space-y-1">
              <span className={label}>Button link</span>
              <input name="buttonLink" defaultValue={banner?.buttonLink ?? ""} placeholder="/category/earrings or https://…" className={input} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={banner?.isActive ?? false} /> Show the banner on the website
          </label>
        </ActionForm>
      </section>

      {/* ---------------- Promotions ---------------- */}
      <section className={card}>
        <h2 className="font-semibold">Promotions</h2>
        <p className="mb-4 text-sm text-stone-500">
          The website shows the promotion that is <strong>switched on</strong> and inside its dates (Pakistan time). Set up a sale in advance and it
          appears and disappears by itself. If several are live at once, the one that started most recently shows.
        </p>

        {promotions.length > 0 && (
          <ul className="mb-6 space-y-3">
            {promotions.map((p) => (
              <li key={p.id} className="rounded-lg border border-stone-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    {p.details && <p className="text-sm text-stone-600">{p.details}</p>}
                    <p className="text-xs text-stone-500">
                      {p.startsAt ? `From ${pktText(p.startsAt)}` : "From now"} · {p.endsAt ? `until ${pktText(p.endsAt)}` : "no end date"}
                      {p.linkUrl && ` · links to ${p.linkUrl}`}
                    </p>
                  </div>
                  <span className={`${badge} ${STATE[p.state][1]}`}>{STATE[p.state][0]}</span>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-stone-600">Edit</summary>
                  <div className="mt-3 space-y-3">
                    <ActionForm action={updatePromotionAction.bind(null, p.id)} resetKey={p.updatedAt.getTime()} className="space-y-3">
                      <PromotionFields p={p} />
                    </ActionForm>
                    <form action={deletePromotionAction.bind(null, p.id)}>
                      <ConfirmButton message={`Delete the promotion “${p.title}”?`} className={`${btnDanger} !py-1 text-xs`}>
                        Delete promotion
                      </ConfirmButton>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        <details open={promotions.length === 0} className="rounded-lg border border-dashed border-stone-300 p-4">
          <summary className="cursor-pointer text-sm font-semibold">+ Add a promotion</summary>
          <ActionForm action={createPromotionAction} submitLabel="Add promotion" pendingLabel="Adding…" className="mt-3 space-y-3">
            <PromotionFields />
          </ActionForm>
        </details>
      </section>
    </div>
  );
}

function PromotionFields({ p }: { p?: Promotion }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className={label}>Headline</span>
          <input name="title" required defaultValue={p?.title ?? ""} maxLength={120} placeholder="e.g. Eid Sale — 20% off earrings" className={input} />
        </label>
        <label className="block space-y-1">
          <span className={label}>Extra line (optional)</span>
          <input name="details" defaultValue={p?.details ?? ""} maxLength={300} placeholder="e.g. Ends Sunday · while stocks last" className={input} />
        </label>
        <label className="block space-y-1">
          <span className={label}>Button text (optional)</span>
          <input name="linkText" defaultValue={p?.linkText ?? ""} maxLength={30} placeholder="e.g. Shop the sale" className={input} />
        </label>
        <label className="block space-y-1">
          <span className={label}>Link (optional)</span>
          <input name="linkUrl" defaultValue={p?.linkUrl ?? ""} placeholder="/category/earrings or https://…" className={input} />
        </label>
        <label className="block space-y-1">
          <span className={label}>Starts (blank = now)</span>
          <input name="startsAt" type="datetime-local" defaultValue={pktInput(p?.startsAt ?? null)} className={input} />
        </label>
        <label className="block space-y-1">
          <span className={label}>Ends (blank = no end)</span>
          <input name="endsAt" type="datetime-local" defaultValue={pktInput(p?.endsAt ?? null)} className={input} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} /> Switched on
      </label>
    </>
  );
}

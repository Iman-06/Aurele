import { revalidatePath } from "next/cache";
import Link from "next/link";
import { pkt } from "@/components/admin/order-badges";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { btnDanger, btnSecondary, card, input } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { listSubscribers, removeSubscriber } from "@/server/admin/subscribers";
import { requireAdmin } from "@/server/auth/admin-session";

export const metadata = { title: "Subscribers" };

async function removeAction(id: number) {
  "use server";
  await requireAdmin();
  await removeSubscriber(db, id).catch(() => {}); // already gone is fine
  revalidatePath("/admin/subscribers");
}

export default async function SubscribersPage({ searchParams }: PageProps<"/admin/subscribers">) {
  await requireAdmin();
  const sp = await searchParams;
  const data = await listSubscribers(db, { q: typeof sp.q === "string" ? sp.q : undefined, page: typeof sp.page === "string" ? sp.page : undefined });
  const pageHref = (p: number) => `/admin/subscribers?${new URLSearchParams({ ...(data.q ? { q: data.q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mailing list</h1>
          <p className="text-sm text-stone-500">
            {data.allTime} subscriber{data.allTime === 1 ? "" : "s"} · {data.last30} joined in the last 30 days
          </p>
        </div>
        {/* Plain link: the browser downloads the file */}
        <a href="/api/admin/subscribers/export" className={btnSecondary}>
          ⬇ Export to Excel
        </a>
      </div>

      <form className="flex gap-3" role="search">
        <input name="q" defaultValue={data.q} placeholder="Search email" className={`${input} w-72`} aria-label="Search email" />
        <button className={btnSecondary}>Search</button>
      </form>

      <section className={card}>
        {data.rows.length === 0 ? (
          <p className="text-sm text-stone-500">{data.q ? "No one matches." : "No one has signed up yet. The sign-up form is in the website footer."}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {data.rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <a href={`mailto:${s.email}`} className="font-medium hover:underline">
                    {s.email}
                  </a>
                  <span className="block text-xs text-stone-500">Joined {pkt.format(s.createdAt)}</span>
                </span>
                <form action={removeAction.bind(null, s.id)}>
                  <ConfirmButton message={`Remove ${s.email} from the mailing list?`} className={`${btnDanger} !py-1 text-xs`}>
                    Remove
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {data.page > 1 && (
            <Link href={pageHref(data.page - 1)} className={btnSecondary}>
              ← Newer
            </Link>
          )}
          <span className="text-stone-500">
            Page {data.page} of {data.totalPages}
          </span>
          {data.page < data.totalPages && (
            <Link href={pageHref(data.page + 1)} className={btnSecondary}>
              Older →
            </Link>
          )}
        </div>
      )}
      <p className="text-xs text-stone-500">Use “Remove” when someone asks to unsubscribe.</p>
    </div>
  );
}

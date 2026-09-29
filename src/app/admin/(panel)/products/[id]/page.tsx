import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { badge, btnDanger, btnSecondary, card, input, label } from "@/components/admin/ui";
import type { Finish } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { CATEGORY_LABELS, designCode, formatRs } from "@/lib/format";
import { getAdminProduct, type AdminProduct } from "@/server/admin/products";
import { requireAdmin } from "@/server/auth/admin-session";
import { COLOURS, FINISH_LABELS, NO_COLOUR, RING_SIZES } from "@/server/inventory/catalog-rules";
import {
  addImageAction,
  addVariantAction,
  deleteImageAction,
  deleteProductAction,
  deleteVariantAction,
  moveImageAction,
  setFinishPriceAction,
  toggleProductFlagAction,
  updateProductAction,
  updateVariantAction,
} from "../actions";

export const metadata = { title: "Edit design" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? await getAdminProduct(db, id) : null;
  if (!p) notFound();

  const isRing = p.category === "RINGS";
  const finishes = (["GOLD", "SILVER"] as Finish[]).filter((f) => p.variants.some((v) => v.finish === f));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm text-stone-500 hover:text-stone-800">
            ← Products
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{p.name}</h1>
          <p className="text-sm text-stone-500">
            {designCode(p.category, p.articleNo)} · {CATEGORY_LABELS[p.category]} · /{p.slug}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {p.isActive ? (
              <span className={`${badge} bg-emerald-50 text-emerald-700`}>Visible</span>
            ) : (
              <span className={`${badge} bg-stone-100 text-stone-600`}>Hidden</span>
            )}
            {p.isNewArrival && <span className={`${badge} bg-violet-50 text-violet-700`}>New Arrival</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={toggleProductFlagAction.bind(null, p.id, "isActive", !p.isActive)}>
            <button className={btnSecondary}>{p.isActive ? "Hide from website" : "Show on website"}</button>
          </form>
          <form action={toggleProductFlagAction.bind(null, p.id, "isNewArrival", !p.isNewArrival)}>
            <button className={btnSecondary}>{p.isNewArrival ? "Remove from New Arrivals" : "Mark as New Arrival"}</button>
          </form>
        </div>
      </div>

      {/* Details */}
      <section className={card}>
        <h2 className="mb-4 font-semibold">Details</h2>
        {/* resetKey: refill inputs after every save so they always show the saved values */}
        <ActionForm resetKey={p.updatedAt.getTime()} action={updateProductAction.bind(null, p.id)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="name" className={label}>
              Name
            </label>
            <input id="name" name="name" required defaultValue={p.name} className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="description" className={label}>
              Description
            </label>
            <textarea id="description" name="description" rows={3} defaultValue={p.description ?? ""} className={input} />
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isActive" defaultChecked={p.isActive} /> Visible on the website
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isNewArrival" defaultChecked={p.isNewArrival} /> New Arrival
            </label>
          </div>
        </ActionForm>
      </section>

      {/* Prices by finish */}
      {finishes.length > 0 && (
        <section className={card}>
          <h2 className="font-semibold">Price by finish</h2>
          <p className="mb-4 text-sm text-stone-500">Sets the price for every colour and size of that finish at once.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {finishes.map((f) => (
              <FinishPrice key={f} product={p} finish={f} />
            ))}
          </div>
        </section>
      )}

      {/* Stock rows */}
      <section className={card}>
        <h2 className="font-semibold">Finishes, colours{isRing ? ", sizes" : ""} &amp; stock</h2>
        <p className="mb-4 text-sm text-stone-500">
          Each row is one stockable item. Untick <em>Visible</em> to mark it sold out / hide it without changing stock.
        </p>
        {p.variants.length === 0 ? (
          <p className="rounded-md border border-dashed border-stone-300 p-4 text-sm text-stone-500">No rows yet — add one below.</p>
        ) : (
          <div className="space-y-3">
            {p.variants.map((v) => (
              <div key={v.id} className="rounded-lg border border-stone-200 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{FINISH_LABELS[v.finish]}</span>
                  {v.colour !== NO_COLOUR && <span>· {v.colour}</span>}
                  {v.size && <span>· size {v.size}</span>}
                  <span className="text-xs text-stone-400">{v.sku}</span>
                  {v.sellingPrice === null && <span className={`${badge} bg-amber-50 text-amber-800`}>No price — hidden on website</span>}
                  {v.quantity === 0 && <span className={`${badge} bg-stone-100 text-stone-600`}>Out of stock</span>}
                </div>
                {/* resetKey: a stale quantity box must never be saved back over a newer sale */}
                <ActionForm
                  resetKey={v.updatedAt.getTime()}
                  action={updateVariantAction.bind(null, p.id, v.id, v.quantity)}
                  className="flex flex-wrap items-end gap-3"
                >
                  <Field label="Quantity" name="quantity" defaultValue={v.quantity} inputMode="numeric" width="w-24" />
                  <Field label="Selling price" name="sellingPrice" defaultValue={v.sellingPrice?.toString() ?? ""} placeholder="—" width="w-32" />
                  <Field label="Cost price" name="costPrice" defaultValue={v.costPrice?.toString() ?? ""} placeholder="—" width="w-32" />
                  <label className="flex items-center gap-2 pb-1.5 text-sm">
                    <input type="checkbox" name="isActive" defaultChecked={v.isActive} /> Visible
                  </label>
                </ActionForm>
                {v._count.orderItems === 0 && (
                  <div className="mt-2">
                    <ActionForm
                      action={deleteVariantAction.bind(null, p.id, v.id)}
                      submitLabel="Delete row"
                      pendingLabel="Deleting…"
                      submitClassName={`${btnDanger} !py-1 text-xs`}
                      confirm={`Delete ${FINISH_LABELS[v.finish]} ${v.colour !== NO_COLOUR ? v.colour : ""} ${v.size}?`}
                    >
                      {null}
                    </ActionForm>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border-t border-stone-100 pt-4">
          <h3 className="mb-3 text-sm font-semibold">Add a finish / colour{isRing ? " / size" : ""}</h3>
          <ActionForm action={addVariantAction.bind(null, p.id)} submitLabel="Add" pendingLabel="Adding…" className="flex flex-wrap items-end gap-3">
            <Select label="Finish" name="finish" options={[["GOLD", "Gold"], ["SILVER", "Silver"]]} required />
            <Select label="Colour" name="colour" options={COLOURS.map((c) => [c === NO_COLOUR ? "" : c, c])} />
            {isRing && <Select label="Size" name="size" options={RING_SIZES.map((s) => [s, s])} required />}
            <Field label="Quantity" name="quantity" defaultValue="0" inputMode="numeric" width="w-24" />
            <Field label="Selling price" name="sellingPrice" placeholder="Same as finish" width="w-36" />
            <Field label="Cost price" name="costPrice" placeholder="Same as finish" width="w-36" />
          </ActionForm>
        </div>
      </section>

      {/* Photos */}
      <section className={card}>
        <h2 className="font-semibold">Photos</h2>
        <p className="mb-4 text-sm text-stone-500">
          Tag each photo with its finish and colour so the website shows the right one. Untagged photos are used for the design in general.
        </p>
        {p.images.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {p.images.map((img, i) => (
              <figure key={img.id} className="space-y-1.5">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
                  <Image src={img.url} alt={img.alt ?? p.name} fill sizes="200px" className="object-cover" unoptimized />
                </div>
                <figcaption className="text-xs text-stone-600">
                  {img.finish ? FINISH_LABELS[img.finish] : "General"}
                  {img.colour ? ` · ${img.colour}` : ""}
                </figcaption>
                <div className="flex gap-1">
                  <form action={moveImageAction.bind(null, p.id, img.id, "up")}>
                    <button disabled={i === 0} className={`${btnSecondary} !px-2 !py-0.5 text-xs`} aria-label="Move earlier">
                      ←
                    </button>
                  </form>
                  <form action={moveImageAction.bind(null, p.id, img.id, "down")}>
                    <button disabled={i === p.images.length - 1} className={`${btnSecondary} !px-2 !py-0.5 text-xs`} aria-label="Move later">
                      →
                    </button>
                  </form>
                  <form action={deleteImageAction.bind(null, p.id, img.id)}>
                    <ConfirmButton message="Delete this photo?" className={`${btnDanger} !px-2 !py-0.5 text-xs`}>
                      Delete
                    </ConfirmButton>
                  </form>
                </div>
              </figure>
            ))}
          </div>
        )}
        <ActionForm action={addImageAction.bind(null, p.id)} submitLabel="Upload photo" pendingLabel="Uploading…" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="photo" className={label}>
              Photo (JPG, PNG, WebP · max 5 MB)
            </label>
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" />
          </div>
          <Select label="Finish" name="finish" options={[["", "Any (general)"], ["GOLD", "Gold"], ["SILVER", "Silver"]]} />
          <Select label="Colour" name="colour" options={[["", "Any"], ...COLOURS.filter((c) => c !== NO_COLOUR).map((c) => [c, c] as [string, string])]} />
          <Field label="Description (optional)" name="alt" placeholder="e.g. worn on ear" width="w-48" />
        </ActionForm>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-100 bg-red-50/40 p-5">
        <h2 className="font-semibold text-red-800">Delete design</h2>
        <p className="mb-3 text-sm text-stone-600">Only possible if it has never been sold. Otherwise use “Hide from website”.</p>
        <ActionForm
          action={deleteProductAction.bind(null, p.id)}
          submitLabel="Delete design"
          pendingLabel="Deleting…"
          submitClassName={btnDanger}
          confirm={`Delete "${p.name}" and all its rows and photos? This can't be undone.`}
        >
          {null}
        </ActionForm>
      </section>
    </div>
  );
}

function FinishPrice({ product, finish }: { product: AdminProduct; finish: Finish }) {
  const rows = product.variants.filter((v) => v.finish === finish);
  const prices = [...new Set(rows.map((v) => (v.sellingPrice === null ? "none" : v.sellingPrice.toString())))];
  const summary = prices.length === 1 ? (prices[0] === "none" ? "Not priced" : formatRs(prices[0])) : "Different prices";
  const current = prices.length === 1 && prices[0] !== "none" ? prices[0] : "";
  return (
    <div className="rounded-lg border border-stone-200 p-4">
      <p className="mb-2 text-sm">
        <span className="font-medium">{FINISH_LABELS[finish]}</span> · {rows.length} item{rows.length === 1 ? "" : "s"} ·{" "}
        <span className={summary === "Not priced" ? "text-amber-700" : "text-stone-600"}>{summary}</span>
      </p>
      <ActionForm
        resetKey={Math.max(...rows.map((v) => v.updatedAt.getTime()))}
        action={setFinishPriceAction.bind(null, product.id, finish)}
        submitLabel={`Set ${FINISH_LABELS[finish]} price`}
        className="flex flex-wrap items-end gap-3"
      >
        <Field label="Selling price (Rs)" name="sellingPrice" defaultValue={current} required width="w-36" />
        <Field label="Cost price (optional)" name="costPrice" width="w-36" />
      </ActionForm>
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  inputMode?: "numeric";
  width?: string;
}) {
  return (
    <label className={`block space-y-1 ${props.width ?? ""}`}>
      <span className={label}>{props.label}</span>
      <input
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        required={props.required}
        inputMode={props.inputMode ?? (props.name.toLowerCase().includes("price") ? "decimal" : undefined)}
        className={input}
      />
    </label>
  );
}

function Select({ label: text, name, options, required }: { label: string; name: string; options: [string, string][]; required?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className={label}>{text}</span>
      <select name={name} required={required} className={`${input} w-auto`} defaultValue={required ? "" : options[0]?.[0]}>
        {required && (
          <option value="" disabled>
            Choose…
          </option>
        )}
        {options.map(([v, l]) => (
          <option key={`${v}-${l}`} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

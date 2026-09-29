"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  addImage,
  addVariant,
  createProduct,
  deleteImage,
  deleteProduct,
  deleteVariant,
  moveImage,
  setFinishPrice,
  setProductFlags,
  updateProduct,
  updateVariant,
} from "@/server/admin/products";
import { requireAdmin } from "@/server/auth/admin-session";
import { DomainError } from "@/server/errors";
import { adjustStock } from "@/server/inventory/stock";
import { run, type ActionState } from "../action-state";

// Every action re-checks the admin session (Server Actions are public endpoints).
// Ids are bound on the server with .bind(), not read from hidden form fields.

const fields = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const refresh = (productId?: number) => {
  revalidatePath("/admin/products");
  if (productId) revalidatePath(`/admin/products/${productId}`);
};

export async function createProductAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  let id = 0;
  const result = await run(async () => {
    id = (await createProduct(db, fields(fd))).id;
  });
  if (result?.error) return result;
  refresh();
  redirect(`/admin/products/${id}`);
}

export async function updateProductAction(productId: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    await updateProduct(db, productId, fields(fd));
    refresh(productId);
    return "Design saved";
  });
}

export async function toggleProductFlagAction(productId: number, flag: "isActive" | "isNewArrival", value: boolean): Promise<void> {
  await requireAdmin();
  await setProductFlags(db, productId, { [flag]: value });
  refresh(productId);
}

export async function deleteProductAction(productId: number, _s: ActionState): Promise<ActionState> {
  await requireAdmin();
  const result = await run(() => deleteProduct(db, productId));
  if (result?.error) return result;
  refresh();
  redirect("/admin/products");
}

export async function setFinishPriceAction(productId: number, finish: "GOLD" | "SILVER", _s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    const n = await setFinishPrice(db, productId, { finish, ...fields(fd) });
    refresh(productId);
    return `Price set for ${n} ${finish === "GOLD" ? "Gold" : "Silver"} item${n === 1 ? "" : "s"}`;
  });
}

export async function addVariantAction(productId: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    await addVariant(db, productId, fields(fd));
    refresh(productId);
    return "Added";
  });
}

/** Save a stock row: prices + visible switch, and quantity (conflict-safe) if it was changed. */
export async function updateVariantAction(productId: number, variantId: number, expectedQuantity: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    const f = fields(fd);
    await updateVariant(db, variantId, f);
    const qty = f.quantity?.trim() === "" || f.quantity === undefined ? expectedQuantity : Number(f.quantity);
    if (!Number.isInteger(qty) || qty < 0) throw new DomainError("INVALID_INPUT", "Quantity must be a whole number, 0 or more");
    if (qty !== expectedQuantity) await adjustStock(db, { variantId, expectedQuantity, newQuantity: qty, note: "Edited on product page" });
    refresh(productId);
    return "Saved";
  });
}

export async function deleteVariantAction(productId: number, variantId: number, _s: ActionState): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    await deleteVariant(db, variantId);
    refresh(productId);
    return "Deleted";
  });
}

export async function addImageAction(productId: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    const file = fd.get("photo");
    if (!(file instanceof File)) throw new DomainError("INVALID_INPUT", "Please choose a photo to upload");
    await addImage(db, productId, file, fields(fd));
    refresh(productId);
    return "Photo uploaded";
  });
}

export async function deleteImageAction(productId: number, imageId: number): Promise<void> {
  await requireAdmin();
  await deleteImage(db, imageId);
  refresh(productId);
}

export async function moveImageAction(productId: number, imageId: number, direction: "up" | "down"): Promise<void> {
  await requireAdmin();
  await moveImage(db, imageId, direction);
  refresh(productId);
}

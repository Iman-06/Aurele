"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth/admin-session";
import { createPromotion, deletePromotion, saveBanner, updatePromotion } from "@/server/content/homepage";
import { run, type ActionState } from "../action-state";

const fields = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const file = (fd: FormData, name: string) => {
  const f = fd.get(name);
  return f instanceof File && f.size > 0 ? f : null;
};
const id = (v: unknown) => z.number().int().positive().parse(v); // bound args come from the browser
const refresh = () => revalidatePath("/admin/homepage");

export async function saveBannerAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    const b = await saveBanner(db, fields(fd), { image: file(fd, "image"), mobileImage: file(fd, "mobileImage") });
    refresh();
    return b.isActive ? "Banner saved — it's live on the homepage" : "Banner saved (switched off)";
  });
}

export async function createPromotionAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    await createPromotion(db, fields(fd));
    refresh();
    return "Promotion added";
  });
}

export async function updatePromotionAction(promotionId: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    await updatePromotion(db, id(promotionId), fields(fd));
    refresh();
    return "Saved";
  });
}

export async function deletePromotionAction(promotionId: number): Promise<void> {
  await requireAdmin();
  await deletePromotion(db, id(promotionId)).catch(() => {}); // already gone is fine
  refresh();
}

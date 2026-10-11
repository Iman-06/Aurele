"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { updateStoreDetails } from "@/server/admin/store-details";
import { requireAdmin } from "@/server/auth/admin-session";
import { run, type ActionState } from "../action-state";

export async function saveStoreDetailsAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    await updateStoreDetails(db, Object.fromEntries(fd));
    // The announcement bar and footer are on every page of the website.
    revalidatePath("/", "layout");
    return "Store details saved";
  });
}

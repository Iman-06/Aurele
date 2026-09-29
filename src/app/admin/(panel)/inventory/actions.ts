"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runStagedImport, stageImport } from "@/server/admin/excel-import";
import { receiveStock, updateSettings } from "@/server/admin/inventory";
import { requireAdmin } from "@/server/auth/admin-session";
import { DomainError } from "@/server/errors";
import type { ImportReport } from "@/server/inventory/importer";
import { adjustStock } from "@/server/inventory/stock";
import { run, type ActionState } from "../action-state";

const refreshStock = () => {
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products", "layout");
};

/** Set an exact quantity (stock count). Refused if a sale changed it since the page loaded. */
export async function setQuantityAction(variantId: number, expectedQuantity: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    const raw = String(fd.get("quantity") ?? "").trim();
    const qty = Number(raw);
    if (raw === "" || !Number.isInteger(qty) || qty < 0) throw new DomainError("INVALID_INPUT", "Quantity must be a whole number, 0 or more");
    if (qty === expectedQuantity) return "No change";
    await adjustStock(db, { variantId, expectedQuantity, newQuantity: qty, note: String(fd.get("note") ?? "").trim() || "Stock count" });
    refreshStock();
    return "Saved";
  });
}

export async function receiveStockAction(variantId: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    const total = await receiveStock(db, { variantId, add: fd.get("add"), note: String(fd.get("note") ?? "") });
    refreshStock();
    return `Added — now ${total}`;
  });
}

export async function saveSettingsAction(_s: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  return run(async () => {
    await updateSettings(db, Object.fromEntries(fd));
    revalidatePath("/admin", "layout");
    return "Settings saved";
  });
}

// ---- Excel import (preview → apply) ------------------------------------

export type ImportState = { token?: string; report?: ImportReport; applied?: boolean; error?: string } | null;

export async function previewImportAction(_s: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  try {
    const file = fd.get("file");
    if (!(file instanceof File)) throw new DomainError("INVALID_INPUT", "Please choose the inventory Excel file");
    const token = await stageImport(file);
    return { token, report: await runStagedImport(db, token, { apply: false }) };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
}

export async function applyImportAction(_s: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  try {
    const token = String(fd.get("token") ?? "");
    const report = await runStagedImport(db, token, { apply: true, overwriteStock: fd.get("overwriteStock") === "on" });
    refreshStock();
    return { report, applied: true };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
}

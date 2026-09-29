"use client";

import Link from "next/link";
import { useActionState } from "react";
import { btn, btnSecondary, card } from "@/components/admin/ui";
import type { ImportReport } from "@/server/inventory/importer";
import { applyImportAction, previewImportAction, type ImportState } from "../actions";

export function ImportFlow() {
  const [preview, previewAction, previewing] = useActionState<ImportState, FormData>(previewImportAction, null);
  const [result, applyAction, applying] = useActionState<ImportState, FormData>(applyImportAction, null);

  if (result?.applied && result.report) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-md bg-emerald-50 px-4 py-3 text-emerald-800">
          ✔ Import saved.
        </p>
        <Report r={result.report} />
        <Link href="/admin/inventory" className={btn}>
          Go to inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={previewAction} className={`${card} space-y-3`}>
        <label className="block space-y-1">
          <span className="block text-sm font-medium">1. Choose the inventory workbook (.xlsx)</span>
          <input name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="text-sm" />
        </label>
        <button disabled={previewing} className={btnSecondary}>
          {previewing ? "Checking…" : "2. Preview changes"}
        </button>
        <p className="text-xs text-stone-500">Nothing is saved until you press Apply.</p>
        {preview?.error && (
          <p role="alert" className="text-sm text-red-700">
            {preview.error}
          </p>
        )}
      </form>

      {preview?.report && preview.token && (
        <div className="space-y-4">
          <Report r={preview.report} />
          <form action={applyAction} className={`${card} space-y-3`}>
            <input type="hidden" name="token" value={preview.token} />
            {preview.report.stockProtected && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="overwriteStock" className="mt-1" />
                <span>
                  <strong>Also replace stock quantities with the sheet&apos;s numbers.</strong> Orders already exist, so quantities are protected by default — only tick
                  this if the sheet is a fresh stock count that already accounts for every sale.
                </span>
              </label>
            )}
            <button disabled={applying} className={btn}>
              {applying ? "Saving…" : "3. Apply these changes"}
            </button>
            {result?.error && (
              <p role="alert" className="text-sm text-red-700">
                {result.error}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

function Report({ r }: { r: ImportReport }) {
  const errors = r.issues.filter((i) => i.level === "error");
  const warnings = r.issues.filter((i) => i.level === "warning");
  return (
    <div className={`${card} space-y-4 text-sm`}>
      <h2 className="font-semibold">{r.dryRun ? "Preview — nothing saved yet" : "What was saved"}</h2>
      <ul className="grid gap-1 sm:grid-cols-2">
        <li>Designs: {r.productsCreated} new, {r.productsUpdated} renamed</li>
        <li>
          Stock rows: {r.variantsCreated} new, {r.variantsUpdated} updated, {r.variantsUnchanged} unchanged
        </li>
        <li className={r.missingSellingPrice ? "text-amber-700" : ""}>{r.missingSellingPrice} row(s) without a selling price (hidden on the website)</li>
        <li>{r.missingPhotoRef} row(s) without a photo reference</li>
      </ul>
      {r.stockProtected && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">Orders exist, so existing stock quantities are protected (not changed).</p>
      )}
      {r.stockChanges.length > 0 && (
        <details open={r.stockChanges.length <= 30}>
          <summary className="cursor-pointer font-medium">Stock changes ({r.stockChanges.length})</summary>
          <ul className="mt-2 space-y-0.5">
            {r.stockChanges.map((c, i) => (
              <li key={i}>
                <span className="text-stone-400">{c.sku}</span> {c.label}: {c.from} → <strong>{c.to}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}
      {errors.length > 0 && (
        <div>
          <p className="font-medium text-red-700">Rows NOT imported ({errors.length})</p>
          <ul className="mt-1 space-y-0.5 text-red-700">
            {errors.map((e, i) => (
              <li key={i}>
                {e.where}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <p className="font-medium text-amber-800">Warnings ({warnings.length})</p>
          <ul className="mt-1 space-y-0.5 text-amber-900">
            {warnings.map((w, i) => (
              <li key={i}>
                {w.where}: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.notInSheet.length > 0 && (
        <div>
          <p className="font-medium">In the website but not in the sheet ({r.notInSheet.length}) — left as they are</p>
          <ul className="mt-1 space-y-0.5 text-stone-600">
            {r.notInSheet.map((n, i) => (
              <li key={i}>
                {n.sku} {n.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

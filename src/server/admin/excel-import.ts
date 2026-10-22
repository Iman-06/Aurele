import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { applyImport, parseWorkbook, type ImportReport } from "../inventory/importer";

// Excel import from the admin panel, in two steps — nothing is ever stored on the server's disk,
// so it works on any host (Railway restarts, read-only serverless disks, several instances):
//   1. previewImport(file)                  → checks the file, dry run, returns the report + the file's fingerprint
//   2. applyImport(file, fingerprint, …)    → the browser sends the SAME file again; it's only applied if its
//                                             fingerprint matches the one that was previewed
// The page keeps the chosen file in memory between the two steps, so the owner doesn't re-pick it.

const MAX_BYTES = 5 * 1024 * 1024;
const FINGERPRINT = /^[a-f0-9]{64}$/;

export const fingerprintOf = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function readUpload(file: File) {
  if (!file || file.size === 0) throw new DomainError("INVALID_INPUT", "Please choose the inventory Excel file");
  if (file.size > MAX_BYTES) throw new DomainError("INVALID_INPUT", "File is too large — maximum 5 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  // .xlsx files are zip archives: they start with "PK\x03\x04"
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw new DomainError("INVALID_INPUT", "Please upload an Excel .xlsx file (old .xls and CSV aren't supported)");
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  } catch {
    throw new DomainError("INVALID_INPUT", "That file couldn't be read as an Excel workbook (.xlsx)");
  }
  return { bytes, wb };
}

/** Step 1: dry run — nothing is saved. Returns what would change and the file's fingerprint. */
export async function previewImport(db: PrismaClient, file: File): Promise<{ report: ImportReport; fingerprint: string }> {
  const { bytes, wb } = await readUpload(file);
  const report = await applyImport(db, parseWorkbook(wb), { dryRun: true });
  return { report, fingerprint: fingerprintOf(bytes) };
}

/** Step 2: apply for real — only the exact file that was previewed. */
export async function applyPreviewedImport(
  db: PrismaClient,
  file: File,
  fingerprint: string,
  opts: { overwriteStock?: boolean } = {},
): Promise<ImportReport> {
  if (!FINGERPRINT.test(fingerprint)) throw new DomainError("INVALID_INPUT", "Please preview the file first, then apply");
  const { bytes, wb } = await readUpload(file);
  if (fingerprintOf(bytes) !== fingerprint) {
    throw new DomainError("INVALID_INPUT", "This isn't the file you previewed — please preview it again before applying");
  }
  return applyImport(db, parseWorkbook(wb), { dryRun: false, overwriteStock: opts.overwriteStock });
}

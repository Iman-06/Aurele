import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { applyImport, parseWorkbook, type ImportReport } from "../inventory/importer";

// Excel import from the admin panel, in two steps:
//   1. stageImport(file)          → checks the file, keeps it for up to 2 hours, returns a token
//   2. runStagedImport(token, …)  → preview (dry run, nothing saved) or apply for real
// The token lets the owner review the preview and then click Apply without re-uploading.

const MAX_BYTES = 5 * 1024 * 1024;
const TTL_MS = 2 * 3600_000;
const TOKEN = /^[a-f0-9-]{36}$/;
const dir = () => path.join(/*turbopackIgnore: true*/ process.env.IMPORT_DIR ?? path.join(process.cwd(), "storage", "imports"));
const fileFor = (token: string) => path.join(/*turbopackIgnore: true*/ dir(), `${token}.xlsx`);

async function loadWorkbook(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  } catch {
    throw new DomainError("INVALID_INPUT", "That file couldn't be read as an Excel workbook (.xlsx)");
  }
  return wb;
}

export async function stageImport(file: File): Promise<string> {
  if (!file || file.size === 0) throw new DomainError("INVALID_INPUT", "Please choose the inventory Excel file");
  if (file.size > MAX_BYTES) throw new DomainError("INVALID_INPUT", "File is too large — maximum 5 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  // .xlsx files are zip archives: they start with "PK\x03\x04"
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw new DomainError("INVALID_INPUT", "Please upload an Excel .xlsx file (old .xls and CSV aren't supported)");
  }
  await loadWorkbook(bytes); // make sure it really opens before keeping it

  const token = randomUUID();
  await mkdir(/*turbopackIgnore: true*/ dir(), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ fileFor(token), bytes);
  return token;
}

export async function runStagedImport(
  db: PrismaClient,
  token: string,
  opts: { apply: boolean; overwriteStock?: boolean },
  now = new Date(),
): Promise<ImportReport> {
  if (!TOKEN.test(token)) throw new DomainError("INVALID_INPUT", "Upload expired — please upload the file again");
  const file = fileFor(token);
  const info = await stat(/*turbopackIgnore: true*/ file).catch(() => null);
  if (!info || now.getTime() - info.mtimeMs > TTL_MS) {
    if (info) await unlink(/*turbopackIgnore: true*/ file).catch(() => {});
    throw new DomainError("INVALID_INPUT", "Upload expired — please upload the file again");
  }

  const wb = await loadWorkbook(await readFile(/*turbopackIgnore: true*/ file));
  const report = await applyImport(db, parseWorkbook(wb), { dryRun: !opts.apply, overwriteStock: opts.overwriteStock });
  if (opts.apply) await unlink(/*turbopackIgnore: true*/ file).catch(() => {});
  return report;
}

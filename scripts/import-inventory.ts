import "dotenv/config";
import path from "node:path";
import { db } from "@/lib/db";
import { applyImport, formatReport, loadWorkbook, parseWorkbook } from "@/server/inventory/importer";

// Usage:
//   npm run import:inventory                    import data/Lunara_Inventory_System_FINAL.xlsx
//   npm run import:inventory -- --dry-run       preview only, nothing saved
//   npm run import:inventory -- --overwrite-stock   replace quantities even if orders exist
//   npm run import:inventory -- --file path/to/other.xlsx

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.indexOf("--file");
  const file = fileArg >= 0 ? args[fileArg + 1] : path.join("data", "Lunara_Inventory_System_FINAL.xlsx");

  const wb = await loadWorkbook(file);
  const parsed = parseWorkbook(wb);
  const report = await applyImport(db, parsed, {
    dryRun: args.includes("--dry-run"),
    overwriteStock: args.includes("--overwrite-stock"),
  });
  console.log(`File: ${file}\n`);
  console.log(formatReport(report));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

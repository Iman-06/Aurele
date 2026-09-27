import "dotenv/config";
import path from "node:path";
import { db } from "@/lib/db";
import { ensureDefaultSettings } from "@/server/settings";
import { applyImport, formatReport, loadWorkbook, parseWorkbook } from "@/server/inventory/importer";

// `npm run db:seed` — safe to run repeatedly.
async function main() {
  await ensureDefaultSettings(db);
  console.log("Settings: defaults ensured (shipping Rs 250, low stock ≤ 3)\n");

  const wb = await loadWorkbook(path.join("data", "Lunara_Inventory_System_FINAL.xlsx"));
  console.log(formatReport(await applyImport(db, parseWorkbook(wb))));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

import "dotenv/config";
import { createPrismaClient } from "@/lib/db";

// Point everything (including code that imports `db` from "@/lib/db") at the test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export const testDb = createPrismaClient(process.env.TEST_DATABASE_URL);

/** Empty every table so each test starts clean. */
export async function resetDb() {
  await testDb.$executeRawUnsafe(`
    TRUNCATE "StockMovement", "OrderItem", "Order", "ProductImage", "Variant",
             "Product", "Customer", "AdminUser", "Subscriber", "Setting"
    RESTART IDENTITY CASCADE;
  `);
}

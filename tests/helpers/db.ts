import { createPrismaClient } from "@/lib/db";

// tests/setup-env.ts has already pointed DATABASE_URL at the test database before any
// test code loaded, so the shared `db` used by route handlers is the test DB too.
const url = process.env.TEST_DATABASE_URL!;
export const testDb = createPrismaClient(url);

/** Empty every table so each test starts clean. Refuses to run against anything but the test DB. */
export async function resetDb() {
  if (!/lunara_test/.test(url) || process.env.DATABASE_URL !== url) {
    throw new Error("resetDb() refused: not connected to the lunara_test database");
  }
  await testDb.$executeRawUnsafe(`
    TRUNCATE "StockMovement", "OrderItem", "Order", "ProductImage", "Variant",
             "Product", "Customer", "AdminUser", "Subscriber", "Setting", "HomeBanner", "Promotion"
    RESTART IDENTITY CASCADE;
  `);
}

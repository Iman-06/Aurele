import "dotenv/config";

// Runs before every test file's imports: point ALL database access (including the shared
// `db` in src/lib/db.ts used by route handlers) at the separate test database.
if (!process.env.TEST_DATABASE_URL || !/lunara_test/.test(process.env.TEST_DATABASE_URL)) {
  throw new Error("TEST_DATABASE_URL must point at the lunara_test database");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.CRON_SECRET ??= "test-cron-secret-value";

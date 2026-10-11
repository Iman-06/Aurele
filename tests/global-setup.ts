import "dotenv/config";
import { execSync } from "node:child_process";
import { assertLocalTestDbUrl } from "./helpers/test-db-url";

// Runs once before all tests: bring the separate local test database up to the
// latest migrations. Tests never touch the shared Neon database.
export default function setup() {
  const url = assertLocalTestDbUrl(process.env.TEST_DATABASE_URL);
  execSync("npx prisma migrate deploy", {
    // prisma.config.ts migrates through DIRECT_URL when set, so override both.
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "pipe",
    timeout: 120_000,
  });
}

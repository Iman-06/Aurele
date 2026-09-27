import "dotenv/config";
import { execSync } from "node:child_process";

// Runs once before all tests: bring the separate test database up to the
// latest migrations. Tests never touch the real `lunara` database.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  if (!/lunara_test/.test(url)) throw new Error("TEST_DATABASE_URL must point at a *_test database");
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
    timeout: 120_000,
  });
}

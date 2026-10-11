import "dotenv/config";
import { assertLocalTestDbUrl } from "./helpers/test-db-url";

// Runs before every test file's imports: point ALL database access (including the shared
// `db` in src/lib/db.ts used by route handlers) at the separate local test database.
const url = assertLocalTestDbUrl(process.env.TEST_DATABASE_URL);
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.CRON_SECRET ??= "test-cron-secret-value";

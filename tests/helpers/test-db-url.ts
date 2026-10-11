// The tests wipe their database, so they must only ever run against a LOCAL `*_test` database —
// never the shared Neon database the team uses.
export function assertLocalTestDbUrl(url: string | undefined): string {
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid postgres URL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  const testName = /_test$/.test(u.pathname.slice(1));
  if (!local || !testName) {
    throw new Error("TEST_DATABASE_URL must point at a local *_test database (tests wipe it) — never the shared Neon DB");
  }
  return url;
}

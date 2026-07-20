// Global teardown: clean up test database
// With PostgreSQL, the test database is reset via `prisma db push --force-reset`
// in global-setup on the next run, so no file cleanup is needed.

export default async function globalTeardown() {
  // Nothing to clean up — PostgreSQL databases persist between runs
  // and are reset by global-setup's `prisma db push --force-reset`.
}

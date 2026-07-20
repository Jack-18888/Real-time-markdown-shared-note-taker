// Global setup: push test database schema before all tests
import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

  // Push the Prisma schema to the test database (no migrations, just sync)
  execSync('npx prisma db push --force-reset', {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'pipe',
  });
}

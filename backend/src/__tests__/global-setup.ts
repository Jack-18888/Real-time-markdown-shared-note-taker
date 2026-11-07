// Global setup: recreate the dedicated SQLite database before all tests
import { execFileSync } from 'child_process';
import path from 'path';
import './env-setup';
import { rmSync } from 'fs';

export default async function globalSetup() {

  // Never reset the development database or an externally supplied URL.
  process.env.DATABASE_URL = 'file:./prisma/test.db';
  rmSync(path.resolve(__dirname, '../../prisma/test.db'), { force: true });
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'pipe',
  });
}

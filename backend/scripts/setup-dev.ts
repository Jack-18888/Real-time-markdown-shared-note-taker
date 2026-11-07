import { randomBytes } from 'crypto';
import { existsSync, writeFileSync } from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env');

if (!existsSync(envPath)) {
  const values = [
    'DATABASE_URL="file:./prisma/dev.db"',
    `JWT_ACCESS_SECRET="${randomBytes(32).toString('hex')}"`,
    `JWT_REFRESH_SECRET="${randomBytes(32).toString('hex')}"`,
    'JWT_ACCESS_EXPIRES_IN="15m"',
    'JWT_REFRESH_EXPIRES_IN="7d"',
    'PORT=3000',
    'CLIENT_ORIGIN="http://localhost:5173"',
  ];
  writeFileSync(envPath, `${values.join('\n')}\n`, { flag: 'wx' });
  console.log('Created .env with local SQLite settings and random JWT secrets.');
}

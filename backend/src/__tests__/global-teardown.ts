// Global teardown: clean up test database file
import fs from 'fs';
import path from 'path';

export default async function globalTeardown() {
  const dbPath = path.resolve(__dirname, '../../prisma/test.db');
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Also clean up journal files
    const journalPath = dbPath + '-journal';
    if (fs.existsSync(journalPath)) {
      fs.unlinkSync(journalPath);
    }
    const walPath = dbPath + '-wal';
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
    }
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// Keep integration tests isolated from local development configuration.
Object.assign(process.env, {
  DATABASE_URL: 'file:./prisma/test.db',
  JWT_ACCESS_SECRET: 'test-access-secret-for-integration-tests',
  JWT_REFRESH_SECRET: 'test-refresh-secret-for-integration-tests',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  CLIENT_ORIGIN: 'http://localhost:5173',
  PORT: '3001',
});

export {};

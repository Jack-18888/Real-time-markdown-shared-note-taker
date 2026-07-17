import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import foldersRouter from './routes/folders';
import notesRouter from './routes/notes';
import { initWebSocketServer } from './websocket/server';

// Validate required env vars at startup
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'CLIENT_ORIGIN',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Routes
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/folders', foldersRouter);
  app.use('/api/notes', notesRouter);

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}

export function createServer(app: express.Express) {
  const server = http.createServer(app);
  initWebSocketServer(server);
  return server;
}

// Start server only when run directly (not imported by tests)
if (require.main === module) {
  const PORT = process.env.PORT ?? 3000;
  const app = createApp();
  const server = createServer(app);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

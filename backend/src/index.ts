import 'dotenv/config';
import express from 'express';
import http from 'http';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server };

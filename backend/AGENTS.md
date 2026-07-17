# Backend Agent Instructions

Stack: Node.js + Express + TypeScript + Prisma + SQLite + WebSockets (`ws` library)

Read `docs/api.md`, `docs/schema.md`, `docs/auth.md`, and `docs/conventions.md` before making any backend changes.

---

## Entry Point

`src/index.ts` bootstraps:
1. Express app with `express.json()` and CORS middleware
2. Route registration under `/api`
3. Global error handler (must be registered last)
4. HTTP server creation
5. WebSocket server attached to the same HTTP server

---

## Prisma Client

Always import from the singleton, never instantiate `PrismaClient` directly in multiple files:

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
```

Import it as:
```typescript
import { prisma } from '../lib/prisma';
```

---

## Auth Middleware

`src/middleware/auth.ts` — apply to all protected routes via `router.use(auth)` or per-route.

After the middleware runs, `req.user` is available with shape `{ id: string, email: string }`.

---

## Error Handling

- Services throw `AppError` (from `src/types/index.ts`) for known failures.
- The global error handler in `src/middleware/error.ts` catches all errors and formats them.
- Never send `res.json({ error: ... })` directly in a controller — throw instead so the global handler formats consistently.

---

## Permission Checking

Permission checks belong in the **service layer**, not controllers or middleware. The pattern is:

```typescript
// In a service function
const note = await prisma.note.findUnique({ where: { id: noteId } });
if (!note) throw new AppError(404, 'NOT_FOUND', 'Note not found');

const hasAccess = await resolveNotePermission(note, userId);
if (!hasAccess || hasAccess === 'none') {
  throw new AppError(403, 'FORBIDDEN', 'No access to this note');
}
```

See `docs/schema.md` (Permission Resolution section) for the full resolution logic.

---

## WebSocket Server

`src/websocket/server.ts` — sets up the `ws` WebSocket server.  
`src/websocket/handlers.ts` — handles incoming events by event name.

In-memory room tracking (note rooms, connected clients) lives in `server.ts`. Do not use a database for real-time presence — keep it in memory.

WebSocket authentication: verify the `token` query param on connection upgrade using the same JWT logic as HTTP middleware.

---

## Migration Workflow

When the Prisma schema changes:
```bash
npx prisma migrate dev --name describe_the_change
npx prisma generate
```

Never edit migration files manually.

---

## Key Dependencies

```json
{
  "express": "^4.x",
  "ws": "^8.x",
  "prisma": "^5.x",
  "@prisma/client": "^5.x",
  "bcrypt": "^5.x",
  "jsonwebtoken": "^9.x",
  "dotenv": "^16.x",
  "cors": "^2.x"
}
```

Dev dependencies:
```json
{
  "typescript": "^5.x",
  "ts-node-dev": "^2.x",
  "@types/express": "^4.x",
  "@types/ws": "^8.x",
  "@types/bcrypt": "^5.x",
  "@types/jsonwebtoken": "^9.x",
  "@types/cors": "^2.x"
}
```

---

## Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

---

## tsconfig

Use `"module": "commonjs"`, `"target": "ES2020"`, `"strict": true`, `"outDir": "dist"`, `"rootDir": "src"`.

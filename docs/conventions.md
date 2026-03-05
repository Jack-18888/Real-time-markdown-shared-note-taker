# Conventions

Code style, error formats, and WebSocket event contracts.

---

## Backend Folder Structure

```
backend/src/
├── index.ts               ← Express app + WS server bootstrap
├── routes/
│   ├── auth.ts
│   ├── notes.ts
│   ├── folders.ts
│   └── users.ts
├── controllers/
│   ├── auth.controller.ts
│   ├── notes.controller.ts
│   ├── folders.controller.ts
│   └── users.controller.ts
├── services/
│   ├── auth.service.ts
│   ├── notes.service.ts
│   ├── folders.service.ts
│   └── users.service.ts
├── middleware/
│   ├── auth.ts            ← JWT validation, attaches req.user
│   ├── error.ts           ← Global error handler
│   └── validate.ts        ← Request body validation helper
├── websocket/
│   ├── server.ts          ← WS server setup, connection registry
│   └── handlers.ts        ← WS event dispatch and handler logic
├── types/
│   └── index.ts           ← Shared TypeScript interfaces
└── lib/
    └── prisma.ts          ← Prisma client singleton
```

---

## Layer Responsibilities

| Layer       | Rule                                                                 |
|-------------|----------------------------------------------------------------------|
| Routes      | Define HTTP method + path. Call controller. No logic.               |
| Controllers | Parse `req`, call service, send `res`. No business logic.           |
| Services    | All business logic. No `req`/`res`. Return plain data or throw.     |
| Middleware  | Cross-cutting concerns: auth, validation, error handling.           |
| Prisma lib  | Single Prisma client instance, imported everywhere DB is needed.    |

---

## Standard Error Response Format

All API errors must follow this shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

### Common Error Codes

| HTTP Status | `code`                  | When to use                                      |
|-------------|-------------------------|--------------------------------------------------|
| 400         | `VALIDATION_ERROR`      | Missing/invalid request body fields              |
| 401         | `UNAUTHORIZED`          | Missing, invalid, or expired token               |
| 403         | `FORBIDDEN`             | Authenticated but lacks permission               |
| 404         | `NOT_FOUND`             | Resource does not exist                          |
| 409         | `CONFLICT`              | Duplicate (e.g. email already registered)        |
| 500         | `INTERNAL_ERROR`        | Unexpected server error                          |

### Throwing Errors in Services

Use a custom `AppError` class so the global error handler can catch and format correctly:

```typescript
// backend/src/types/index.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
```

Usage in a service:
```typescript
throw new AppError(404, 'NOT_FOUND', 'Note not found');
throw new AppError(403, 'FORBIDDEN', 'You do not have write access to this note');
```

The global error middleware (`middleware/error.ts`) catches `AppError` and sends the standard JSON response.

---

## Request Validation

Use a lightweight inline validation pattern (no heavy libraries required unless added):

```typescript
// middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';

export function requireFields(fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === '') {
        throw new AppError(400, 'VALIDATION_ERROR', `Missing required field: ${field}`);
      }
    }
    next();
  };
}
```

---

## WebSocket Events

The WS server is mounted on the same HTTP server as Express. Clients connect via:

```
ws://localhost:3000/ws?token=<accessToken>
```

The access token is verified on connection. Invalid tokens are rejected immediately.

---

### Connection Lifecycle

```
Client connects  → server verifies token → client is registered in memory map (userId → ws)
Client disconnects → server removes from map, broadcasts presence update to note room
```

---

### Event Format

All WS messages (both client → server and server → client) use JSON:

```json
{
  "event": "EVENT_NAME",
  "payload": { ... }
}
```

---

### Client → Server Events

#### `note:join`
Client wants to start collaborating on a note.

```json
{
  "event": "note:join",
  "payload": { "noteId": "uuid" }
}
```

Server checks that the user has at least `read` access. If valid, adds them to the note's room. Server responds with `note:joined` or `note:error`.

---

#### `note:leave`
Client stops editing a note.

```json
{
  "event": "note:leave",
  "payload": { "noteId": "uuid" }
}
```

---

#### `note:update`
Client sends a content change. Only allowed if user has `write` access.

```json
{
  "event": "note:update",
  "payload": {
    "noteId": "uuid",
    "content": "full updated markdown string"
  }
}
```

Server saves to DB and broadcasts `note:updated` to all other clients in the room.

---

### Server → Client Events

#### `note:joined`
Acknowledges successful room join. Sends current note content.

```json
{
  "event": "note:joined",
  "payload": {
    "noteId": "uuid",
    "content": "current markdown content",
    "collaborators": ["userId1", "userId2"]
  }
}
```

---

#### `note:updated`
Broadcast to all room members (except sender) when note content changes.

```json
{
  "event": "note:updated",
  "payload": {
    "noteId": "uuid",
    "content": "updated markdown string",
    "updatedBy": "userId"
  }
}
```

---

#### `note:presence`
Broadcast to room when a user joins or leaves.

```json
{
  "event": "note:presence",
  "payload": {
    "noteId": "uuid",
    "collaborators": ["userId1", "userId2"]
  }
}
```

---

#### `note:error`
Sent to the client when a WS operation fails.

```json
{
  "event": "note:error",
  "payload": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this note"
  }
}
```

---

## Naming Conventions

- **Files**: `kebab-case` for all files.
- **Functions/variables**: `camelCase`.
- **Types/interfaces**: `PascalCase`.
- **Constants**: `UPPER_SNAKE_CASE`.
- **DB model fields**: `camelCase` (Prisma default).
- **API route segments**: `kebab-case` (e.g. `/api/note-shares`).
- **WS event names**: `noun:verb` format (e.g. `note:update`, `note:joined`).

---

## TypeScript Interfaces (shared types)

Define shared types in `backend/src/types/index.ts`:

```typescript
export interface AuthUser {
  id: string;
  email: string;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export type Permission = 'read' | 'write' | 'owner';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
```

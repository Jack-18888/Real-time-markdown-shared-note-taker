# Real-time Markdown Note Taker

A collaborative markdown note-taking app with real-time co-editing, file/folder organization, and per-user sharing permissions.

---

## Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | Vue.js 3 (Composition API)          |
| Backend   | Node.js + Express                   |
| Database  | SQLite (via Prisma ORM)             |
| Auth      | JWT (access + refresh token pair)   |
| Real-time | WebSockets (ws library)             |

---

## Project Structure

```
/
├── AGENTS.md                  ← You are here
├── opencode.json              ← Agent instruction wiring
├── docs/
│   ├── api.md                 ← REST API specification
│   ├── schema.md              ← Database schema (Prisma models)
│   ├── auth.md                ← Auth flow and JWT strategy
│   └── conventions.md        ← Code conventions, error formats, WS events
├── backend/
│   ├── AGENTS.md              ← Backend-specific agent instructions
│   ├── prisma/
│   │   └── schema.prisma      ← Prisma schema file
│   └── src/
│       ├── index.ts           ← Entry point (Express + WS server)
│       ├── routes/            ← Route definitions (thin, delegate to controllers)
│       ├── controllers/       ← Request handling logic
│       ├── services/          ← Business logic (no req/res objects here)
│       ├── middleware/        ← Auth, error handling, validation middleware
│       ├── websocket/         ← WS server setup and event handlers
│       └── types/             ← Shared TypeScript interfaces
└── frontend/
    ├── AGENTS.md              ← Frontend-specific agent instructions
    └── src/
        ├── api/               ← Axios/fetch wrappers for backend calls
        ├── components/        ← Reusable Vue components
        ├── views/             ← Page-level Vue components
        ├── stores/            ← Pinia stores (auth, notes, folders)
        ├── composables/       ← Reusable Vue composables
        └── router/            ← Vue Router config
```

---

## Key Documentation

Before making changes, read the relevant doc files:

- **Adding/changing an API endpoint** → read `docs/api.md` and `docs/conventions.md`
- **Changing the database model** → read `docs/schema.md`
- **Touching auth logic** → read `docs/auth.md`
- **Adding WebSocket events** → read `docs/conventions.md` (WS Events section)
- **Backend work** → also read `backend/AGENTS.md`
- **Frontend work** → also read `frontend/AGENTS.md`

---

## Running the Project

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev        # starts on port 3000

# Frontend
cd frontend
npm install
npm run dev        # starts on port 5173
```

---

## Environment Variables

Backend uses a `.env` file at `backend/.env`. Never commit this file.

```
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=
JWT_REFRESH_EXPIRES_IN=
PORT=
CLIENT_ORIGIN=
```

---

## Core Features

1. **Auth** — Register/login with email + password. JWT access + refresh tokens.
2. **Notes** — Create, read, update, delete markdown notes. Organized in folders.
3. **Folders** — Hierarchical folder structure. Folders can be nested.
4. **Sharing** — Share individual notes or folders with other users. Per-user read or write permission.
5. **Real-time collaboration** — Multiple users with write access can edit the same note simultaneously via WebSockets.

---

## Coding Standards

- Use TypeScript throughout (both frontend and backend).
- Prefer `async/await` over `.then()` chains.
- All API errors must follow the standard error format defined in `docs/conventions.md`.
- Never put business logic in route handlers — use controllers and services.
- Never access `req`/`res` inside a service — services are pure business logic.
- All database access goes through Prisma — no raw SQL unless absolutely necessary.

---

## Git Workflow

- **Commit after every task or logical change.** Do not batch multiple tasks into one commit.
- Commit message format: `type(scope): short description` — e.g. `feat(auth): add register and login routes`.
- Common types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
- Never commit `.env` files, `node_modules/`, `dist/`, or SQLite `.db` files.
- Update `tasks.json` (`completed`, `completedAt`, `relatedCommit`) as part of the same commit that completes the task.

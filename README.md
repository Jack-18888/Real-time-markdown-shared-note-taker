# Real-time Markdown Note Taker

A collaborative markdown note-taking application with real-time co-editing, hierarchical folder organization, and per-user sharing permissions.

## Features

- **Markdown editing** — Write notes in markdown with a live side-by-side preview
- **Real-time collaboration** — Multiple users can edit the same note simultaneously via WebSockets
- **Folder organization** — Hierarchical folder structure with drag-free nesting support
- **Sharing** — Share individual notes or entire folders with other users at read or write permission levels
- **JWT authentication** — Secure access/refresh token pair with automatic token rotation and session restore

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | Vue.js 3 (Composition API), Pinia, Vue Router, Axios |
| Backend   | Node.js, Express, TypeScript      |
| Database  | SQLite via Prisma ORM           |
| Auth      | JWT (access + refresh tokens)     |
| Real-time | WebSockets (`ws` library)         |

## Getting Started

### Prerequisites

- Node.js (v24+)
- npm
- SQLite is stored locally; no database server is required.

### Backend

```bash
cd backend
npm install
npm run dev        # starts on http://localhost:3000
```

`npm run dev` creates `backend/.env` with random JWT secrets when missing, generates Prisma Client, and applies SQLite migrations before starting. Existing `.env` files are preserved; set `DATABASE_URL` to the SQLite URL below. Relative paths are resolved from `backend/`.

Example configuration:

```
DATABASE_URL="file:./prisma/dev.db"
JWT_ACCESS_SECRET=<random-64-char-secret>
JWT_REFRESH_SECRET=<different-random-64-char-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
```

### Using Docker

```bash
cd backend
docker compose up     # starts backend with persistent SQLite storage on port 3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # starts on http://localhost:5173
```

## Project Structure

```
├── backend/
│   ├── prisma/              # Prisma schema and migrations
│   └── src/
│       ├── index.ts         # Express + WebSocket server entry point
│       ├── routes/          # Route definitions
│       ├── controllers/     # Request handling
│       ├── services/        # Business logic
│       ├── middleware/       # Auth, error handling, validation
│       ├── websocket/       # WebSocket server and event handlers
│       ├── types/           # Shared TypeScript interfaces
│       └── lib/             # Prisma client singleton
├── frontend/
│   └── src/
│       ├── api/             # Axios client and API wrappers
│       ├── components/      # Reusable Vue components
│       ├── views/           # Page-level Vue components
│       ├── stores/          # Pinia stores (auth, notes, folders)
│       ├── composables/     # WebSocket and collaboration composables
│       └── router/          # Vue Router config
└── docs/                    # API spec, schema, auth flow, conventions
```

## Architecture Highlights

- **Layered backend** — Routes delegate to controllers, controllers call services, services contain all business logic and throw `AppError` for consistent error formatting
- **Permission resolution** — Note access checks owner status, then direct note shares, then folder-level shares
- **Token lifecycle** — Short-lived access tokens (15m) validated by signature only; long-lived refresh tokens (7d) stored server-side with rotation on each refresh
- **WebSocket rooms** — Users join note-specific rooms for real-time updates; presence tracking is kept in memory
- **Graceful degradation** — If the WebSocket connection drops, edits continue saving via REST API

SQLite uses a new database; existing PostgreSQL records are not copied automatically.

Run backend integration tests with `npm test` (uses a separate `prisma/test.db`).

The original PostgreSQL migration is archived in `backend/prisma/postgresql-migrations/`; active migrations target SQLite only.

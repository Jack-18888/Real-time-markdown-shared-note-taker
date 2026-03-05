# Frontend Agent Instructions

Stack: Vue.js 3 (Composition API) + TypeScript + Vite + Pinia + Vue Router

Read `docs/api.md` and `docs/conventions.md` before making frontend changes.

---

## Project Structure

```
frontend/src/
├── main.ts                  ← App entry point, mounts Vue app
├── App.vue                  ← Root component, router-view
├── router/
│   └── index.ts             ← Vue Router config, route guards
├── stores/
│   ├── auth.ts              ← Pinia store: user, tokens, login/logout actions
│   ├── notes.ts             ← Pinia store: notes list, current note, CRUD actions
│   └── folders.ts           ← Pinia store: folder tree, CRUD actions
├── api/
│   ├── client.ts            ← Axios instance with base URL and auth interceptor
│   ├── auth.ts              ← Auth API calls (register, login, refresh, logout)
│   ├── notes.ts             ← Notes API calls
│   ├── folders.ts           ← Folders API calls
│   └── users.ts             ← Users API calls
├── composables/
│   ├── useWebSocket.ts      ← WS connection, event sending/receiving
│   └── useNoteCollaboration.ts ← Joins/leaves note rooms, handles note:updated events
├── components/
│   ├── MarkdownEditor.vue   ← Textarea for editing raw markdown
│   ├── MarkdownPreview.vue  ← Rendered markdown preview
│   ├── FolderTree.vue       ← Sidebar folder/note tree
│   ├── ShareModal.vue       ← UI for sharing a note or folder
│   └── NoteCard.vue         ← Note list item
└── views/
    ├── LoginView.vue
    ├── RegisterView.vue
    ├── DashboardView.vue    ← Note list + folder sidebar
    └── NoteView.vue         ← Full note editor + preview
```

---

## Auth Store

`stores/auth.ts` manages:
- `user` — `{ id, email }` or `null`
- `accessToken` — stored in memory (reactive ref), never in localStorage
- `refreshToken` — stored in `localStorage`

On app startup, attempt a token refresh using the stored refresh token if present.

Actions:
- `login(email, password)` — calls API, stores tokens, sets user
- `register(email, password)` — calls API, same as login flow
- `logout()` — calls API logout, clears all state and localStorage
- `refresh()` — exchanges refresh token for new access token, updates in-memory access token

---

## API Client

`api/client.ts` — a single Axios instance:

```typescript
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const client = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Request interceptor: attach access token
client.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

// Response interceptor: on 401, attempt token refresh then retry
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const auth = useAuthStore();
      const refreshed = await auth.refresh();
      if (refreshed) {
        // Retry original request with new token
        error.config.headers.Authorization = `Bearer ${auth.accessToken}`;
        return client.request(error.config);
      }
      auth.logout();
    }
    return Promise.reject(error);
  }
);

export default client;
```

---

## WebSocket

`composables/useWebSocket.ts` manages the WS connection:

- Connect to `ws://localhost:3000/ws?token=<accessToken>`.
- Reconnect automatically on disconnect.
- Expose `send(event, payload)` helper.
- Expose `on(event, handler)` for subscribing to server events.

`composables/useNoteCollaboration.ts` wraps the WS composable for note-specific use:
- Sends `note:join` when a note is opened.
- Sends `note:leave` when navigating away.
- Sends `note:update` when the user edits content (debounced ~300ms).
- Listens for `note:updated` and updates the note store.
- Listens for `note:presence` to show collaborators.

---

## Routing

| Path               | View              | Auth required |
|--------------------|-------------------|---------------|
| `/login`           | `LoginView`       | No            |
| `/register`        | `RegisterView`    | No            |
| `/`                | `DashboardView`   | Yes           |
| `/notes/:id`       | `NoteView`        | Yes           |

Router guard in `router/index.ts`: redirect unauthenticated users to `/login`. Redirect authenticated users away from `/login` and `/register` to `/`.

---

## State Management Rules

- All API calls go through the Pinia store actions or composables — never call `api/` directly from a component.
- Components read state via store getters/state refs.
- Keep loading and error state inside stores, not component-local.

---

## Key Dependencies

```json
{
  "vue": "^3.x",
  "vue-router": "^4.x",
  "pinia": "^2.x",
  "axios": "^1.x"
}
```

Markdown rendering: use `marked` or `markdown-it` for preview rendering.

Dev dependencies: `vite`, `@vitejs/plugin-vue`, `typescript`, `vue-tsc`.

---

## Component Conventions

- All components use `<script setup lang="ts">`.
- Props must be typed with `defineProps<{...}>()`.
- Emits must be typed with `defineEmits<{...}>()`.
- No Options API. Use Composition API only.
- Keep components focused — extract logic into composables.

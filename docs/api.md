# REST API Specification

Base URL: `http://localhost:3000/api`

All protected routes require the `Authorization: Bearer <access_token>` header.

---

## Auth

### POST `/api/auth/register`

Register a new user.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "plaintext password"
}
```

**Response `201`:**
```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

**Errors:** `400` invalid body, `409` email already in use

---

### POST `/api/auth/login`

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "plaintext password"
}
```

**Response `200`:**
```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

**Errors:** `400` invalid body, `401` invalid credentials

---

### POST `/api/auth/refresh`

Exchange a valid refresh token for a new access token.

**Request body:**
```json
{
  "refreshToken": "<jwt>"
}
```

**Response `200`:**
```json
{
  "accessToken": "<jwt>"
}
```

**Errors:** `401` invalid or expired refresh token

---

### POST `/api/auth/logout`

Invalidate the refresh token (removes it from DB).

**Request body:**
```json
{
  "refreshToken": "<jwt>"
}
```

**Response `204`:** No content

---

## Folders

All folder routes are protected (require valid access token).

### GET `/api/folders`

Returns all folders owned by or shared with the authenticated user.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "My Folder",
    "parentId": null,
    "ownerId": "uuid",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601",
    "permission": "owner" | "read" | "write"
  }
]
```

---

### POST `/api/folders`

Create a new folder.

**Request body:**
```json
{
  "name": "My Folder",
  "parentId": "uuid or null"
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "name": "My Folder",
  "parentId": null,
  "ownerId": "uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors:** `400` invalid body, `403` no write access to parent folder, `404` parent folder not found

---

### PATCH `/api/folders/:id`

Rename a folder or move it to a different parent.

**Request body (all fields optional):**
```json
{
  "name": "New Name",
  "parentId": "uuid or null"
}
```

**Response `200`:** Updated folder object

**Errors:** `403` not owner or no write access, `404` folder not found

---

### DELETE `/api/folders/:id`

Delete a folder and all its contents (notes and subfolders, recursively).

**Response `204`:** No content

**Errors:** `403` not owner, `404` folder not found

---

### GET `/api/folders/:id/shares`

List all users this folder is shared with.

**Response `200`:**
```json
[
  {
    "userId": "uuid",
    "email": "user@example.com",
    "permission": "read" | "write"
  }
]
```

**Errors:** `403` not owner, `404` not found

---

### POST `/api/folders/:id/shares`

Share a folder with another user.

**Request body:**
```json
{
  "email": "targetuser@example.com",
  "permission": "read" | "write"
}
```

**Response `201`:**
```json
{
  "userId": "uuid",
  "email": "targetuser@example.com",
  "permission": "read" | "write"
}
```

**Errors:** `400` invalid body, `403` not owner, `404` folder or target user not found, `409` already shared

---

### PATCH `/api/folders/:id/shares/:userId`

Update a share's permission level.

**Request body:**
```json
{
  "permission": "read" | "write"
}
```

**Response `200`:** Updated share object

**Errors:** `403` not owner, `404` share not found

---

### DELETE `/api/folders/:id/shares/:userId`

Remove a user's access to a folder.

**Response `204`:** No content

**Errors:** `403` not owner, `404` share not found

---

## Notes

All note routes are protected (require valid access token).

### GET `/api/notes`

Returns all notes owned by or shared with the authenticated user.

**Query params (all optional):**
- `folderId` — filter by folder

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "title": "My Note",
    "folderId": "uuid or null",
    "ownerId": "uuid",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601",
    "permission": "owner" | "read" | "write"
  }
]
```

Note: The `content` (markdown body) is NOT returned in list responses for performance. Fetch individual note to get content.

---

### POST `/api/notes`

Create a new note.

**Request body:**
```json
{
  "title": "My Note",
  "content": "# Hello\nMarkdown here.",
  "folderId": "uuid or null"
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "title": "My Note",
  "content": "# Hello\nMarkdown here.",
  "folderId": null,
  "ownerId": "uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors:** `400` invalid body, `403` no write access to folder, `404` folder not found

---

### GET `/api/notes/:id`

Fetch a single note including its full markdown content.

**Response `200`:**
```json
{
  "id": "uuid",
  "title": "My Note",
  "content": "# Hello\nMarkdown here.",
  "folderId": "uuid or null",
  "ownerId": "uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "permission": "owner" | "read" | "write"
}
```

**Errors:** `403` no access, `404` not found

---

### PATCH `/api/notes/:id`

Update a note's title, content, or folder.

**Request body (all fields optional):**
```json
{
  "title": "New Title",
  "content": "Updated markdown.",
  "folderId": "uuid or null"
}
```

**Response `200`:** Updated note object (including content)

**Errors:** `403` no write access, `404` not found

---

### DELETE `/api/notes/:id`

Delete a note.

**Response `204`:** No content

**Errors:** `403` not owner, `404` not found

---

### GET `/api/notes/:id/shares`

List all users this note is shared with.

**Response `200`:**
```json
[
  {
    "userId": "uuid",
    "email": "user@example.com",
    "permission": "read" | "write"
  }
]
```

**Errors:** `403` not owner, `404` not found

---

### POST `/api/notes/:id/shares`

Share a note with another user.

**Request body:**
```json
{
  "email": "targetuser@example.com",
  "permission": "read" | "write"
}
```

**Response `201`:** Share object

**Errors:** `400` invalid body, `403` not owner, `404` note or user not found, `409` already shared

---

### PATCH `/api/notes/:id/shares/:userId`

Update a note share's permission level.

**Request body:**
```json
{
  "permission": "read" | "write"
}
```

**Response `200`:** Updated share object

**Errors:** `403` not owner, `404` share not found

---

### DELETE `/api/notes/:id/shares/:userId`

Remove a user's access to a note.

**Response `204`:** No content

**Errors:** `403` not owner, `404` share not found

---

## Users

### GET `/api/users/me`

Returns the currently authenticated user's profile.

**Response `200`:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "createdAt": "ISO8601"
}
```

---

### GET `/api/users/search?email=...`

Search for a user by email (used when sharing). Only returns exact match to prevent user enumeration.

**Response `200`:**
```json
{
  "id": "uuid",
  "email": "user@example.com"
}
```

**Errors:** `404` user not found

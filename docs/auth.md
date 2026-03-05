# Authentication

Strategy: JWT (JSON Web Tokens)  
Two-token pattern: short-lived **access token** + long-lived **refresh token**

---

## Token Types

| Token   | Storage (client) | Lifetime    | Purpose                              |
|---------|------------------|-------------|--------------------------------------|
| Access  | Memory / JS var  | 15 minutes  | Sent with every API request          |
| Refresh | `localStorage` or `httpOnly cookie` | 7 days | Used to get new access tokens |

Access tokens are **not stored in the database** — they are validated by signature only.  
Refresh tokens **are stored in the database** (`RefreshToken` table) to allow invalidation.

---

## Environment Variables

```
JWT_ACCESS_SECRET=<random 64-char secret>
JWT_REFRESH_SECRET=<different random 64-char secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Use different secrets for access and refresh tokens.

---

## Registration Flow

```
POST /api/auth/register
  → validate body (email, password)
  → check email not already used
  → hash password with bcrypt (cost factor 12)
  → create User in DB
  → sign access token (payload: { sub: userId, email })
  → sign refresh token (payload: { sub: userId })
  → store refresh token in RefreshToken table
  → return { user, accessToken, refreshToken }
```

---

## Login Flow

```
POST /api/auth/login
  → validate body (email, password)
  → find User by email (return 401 if not found — do not reveal existence)
  → compare password with bcrypt
  → sign access token
  → sign refresh token
  → store refresh token in RefreshToken table
  → return { user, accessToken, refreshToken }
```

---

## Token Refresh Flow

```
POST /api/auth/refresh
  → validate body has refreshToken
  → verify JWT signature using JWT_REFRESH_SECRET
  → look up token in RefreshToken table (return 401 if not found or expired)
  → delete old refresh token (rotation)
  → sign new access token
  → sign new refresh token
  → store new refresh token in DB
  → return { accessToken, refreshToken }
```

Refresh token rotation: every refresh call issues a new refresh token and invalidates the old one. This limits the window for stolen token abuse.

---

## Logout Flow

```
POST /api/auth/logout
  → validate body has refreshToken
  → delete matching row from RefreshToken table
  → return 204
```

The access token remains technically valid until it expires. The frontend should discard it immediately on logout.

---

## Auth Middleware

File: `backend/src/middleware/auth.ts`

Applied to all protected routes. Checks the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Middleware logic:
1. Extract token from `Authorization` header.
2. Verify JWT signature with `JWT_ACCESS_SECRET`.
3. If valid, attach decoded payload to `req.user` (`{ id, email }`).
4. If missing or invalid, return `401 Unauthorized`.

```typescript
// Shape attached to req.user
interface AuthUser {
  id: string;
  email: string;
}
```

---

## Password Rules

- Minimum 8 characters.
- No maximum enforced server-side (bcrypt truncates at 72 bytes — document this).
- Stored as bcrypt hash only. Plain text is never persisted.

---

## Security Notes

- Never return password hash in any API response.
- Use `401` for auth failures (not `403` — `403` means authenticated but not authorized).
- Use `403` when the user is authenticated but lacks permission on a resource.
- Rate limiting on `/api/auth/login` and `/api/auth/register` is recommended to prevent brute force.
- Access token payload should contain only `sub` (userId) and `email` — keep it minimal.

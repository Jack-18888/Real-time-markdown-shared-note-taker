# Database Schema

ORM: Prisma  
Database: PostgreSQL  
Schema file: `backend/prisma/schema.prisma`

---

## Models

### User

Stores registered users. Passwords are stored as bcrypt hashes.

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // bcrypt hash
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Owned resources
  notes         Note[]
  folders       Folder[]

  // Tokens
  refreshTokens RefreshToken[]

  // Sharing
  noteShares    NoteShare[]
  folderShares  FolderShare[]
}
```

---

### RefreshToken

Stores issued refresh tokens for server-side invalidation (logout, rotation).

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

**Notes:**
- On logout, the token row is deleted.
- On refresh, the old token is deleted and a new one is inserted (rotation).
- Expired tokens can be cleaned up with a background job or at login time.

---

### Folder

Supports hierarchical nesting via self-referential `parentId`.

```prisma
model Folder {
  id        String   @id @default(uuid())
  name      String
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  parentId  String?
  parent    Folder?  @relation("FolderChildren", fields: [parentId], references: [id])
  children  Folder[] @relation("FolderChildren")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  notes     Note[]
  shares    FolderShare[]
}
```

**Notes:**
- `parentId: null` means the folder is at root level.
- Deleting a folder cascades to its child folders and notes (handled in service layer, not DB cascade, to respect permission checks).
- Folder access can be inherited by contained notes (see Permission Resolution below).

---

### Note

Stores markdown notes.

```prisma
model Note {
  id        String   @id @default(uuid())
  title     String
  content   String   @default("")  // raw markdown
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  folderId  String?
  folder    Folder?  @relation(fields: [folderId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  shares    NoteShare[]
}
```

**Notes:**
- `folderId: null` means the note is at root level (unfiled).
- If a folder is deleted, notes inside are moved to root (`folderId` becomes `null`).

---

### NoteShare

Per-user permissions on individual notes.

```prisma
model NoteShare {
  id         String   @id @default(uuid())
  noteId     String
  note       Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission String   // "read" | "write"
  createdAt  DateTime @default(now())

  @@unique([noteId, userId])
}
```

---

### FolderShare

Per-user permissions on folders.

```prisma
model FolderShare {
  id         String   @id @default(uuid())
  folderId   String
  folder     Folder   @relation(fields: [folderId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission String   // "read" | "write"
  createdAt  DateTime @default(now())

  @@unique([folderId, userId])
}
```

---

## Permission Resolution

When checking whether a user can access a note, the resolution order is:

1. **Owner** — the user's `id` matches `note.ownerId`. Full access.
2. **Direct note share** — a `NoteShare` row exists for `(noteId, userId)`. Use that permission.
3. **Folder share** — the note is inside a folder (`folderId != null`) and a `FolderShare` row exists for `(folderId, userId)`. Use that permission.
4. **No access** — deny.

Folder shares do **not** automatically grant access to notes inside the folder unless the note has no direct share overriding it. Direct note shares take precedence over folder-level shares.

---

## Indexes (to add in schema)

```prisma
// On NoteShare
@@index([userId])
@@index([noteId])

// On FolderShare
@@index([userId])
@@index([folderId])

// On Note
@@index([ownerId])
@@index([folderId])

// On Folder
@@index([ownerId])
@@index([parentId])

// On RefreshToken
@@index([userId])
```

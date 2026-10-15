# ZenChat

Full-featured chat API built with **Express 5**, **Socket.IO**, **Prisma**, and **TypeScript**.

## Features

- **Auth**: register / login (email or username) / refresh (rotating refresh tokens) / logout / me
- **Users**: search, profile update, avatar upload
- **Conversations**: direct (1:1, auto-reuses existing DM) and groups (roles: owner / admin / member)
- **Messages**: send, cursor-paginated history, edit, soft-delete, read receipts + unread counts
- **Friends**: request → accept/decline → remove
- **Real-time (Socket.IO)**: message push, typing indicators, presence (online/offline), read receipts

## Tech stack

| Concern      | Choice                                          |
| ------------ | ----------------------------------------------- |
| Runtime      | Node.js ≥ 20 (built/tested on Node 24)          |
| Language     | TypeScript (strict), ESM                        |
| HTTP         | Express 5                                       |
| Real-time    | Socket.IO 4                                     |
| ORM          | Prisma 6 (SQLite by default; Postgres-ready)    |
| Auth         | jose (HS256 JWT), bcryptjs, rotating refresh    |
| Validation   | Zod                                             |
| Uploads      | Multer (local `uploads/`, served at `/uploads`) |
| Tests        | Vitest + Supertest (separate SQLite test DB)    |
| Lint/format  | ESLint 9 flat config + Prettier                 |

## Quick start

```bash
npm install

# Prisma must be pinned to v6 — do NOT run a bare `npm i prisma@latest`
# (that installs v8, which has a completely different CLI).
npx prisma generate
npm run db:push          # create dev.db from prisma/schema.prisma

npm run dev              # http://localhost:3000 (or PORT in .env)
npm run db:seed          # optional: alice@example.com / bob@example.com (password: password123)
```

Check it's alive: `curl localhost:3000/health`

### Tests

```bash
npm test                 # vitest run — pushes schema to prisma/test.db automatically
npm run typecheck        # tsc --noEmit
npm run lint             # eslint .
npm run build && npm start   # production build (dist/)
```

## Scripts

| Script             | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | tsx watch (hot reload)                       |
| `npm run build`    | tsc → `dist/`                                |
| `npm start`        | run compiled server                          |
| `npm test`         | Vitest                                       |
| `npm run db:push`  | sync SQLite schema (dev)                     |
| `npm run db:seed`  | create demo users + a DM                     |
| `npm run db:studio`| Prisma Studio UI                             |

## REST endpoints

All routes under `/api` except auth are protected with `Authorization: Bearer <accessToken>`.

| Method | Path                                   | Description                          |
| ------ | -------------------------------------- | ------------------------------------ |
| POST   | `/api/auth/register`                   | Create account (returns tokens)      |
| POST   | `/api/auth/login`                      | `{ identifier, password }`           |
| POST   | `/api/auth/refresh`                    | Rotate refresh token                 |
| POST   | `/api/auth/logout`                     | Revoke refresh token                 |
| GET    | `/api/auth/me`                         | Current user                         |
| GET    | `/api/users?q=`                        | Search users                         |
| PATCH  | `/api/users/me`                        | Update displayName / bio             |
| POST   | `/api/users/me/avatar`                 | Multipart upload (`avatar` field)    |
| GET    | `/api/users/:id`                       | Public profile                       |
| POST   | `/api/conversations`                   | Create DIRECT or GROUP               |
| GET    | `/api/conversations`                   | List mine (lastMessage, unreadCount) |
| GET    | `/api/conversations/:id`               | Detail (with members)                |
| POST   | `/api/conversations/:id/read`          | Mark all incoming as read            |
| PATCH  | `/api/conversations/:id`               | Rename group (owner/admin)           |
| POST   | `/api/conversations/:id/members`       | Add members (owner/admin)            |
| DELETE | `/api/conversations/:id/members/:uid`  | Remove member (owner/admin)          |
| DELETE | `/api/conversations/:id/leave`         | Leave / delete conversation          |
| GET    | `/api/messages/conversations/:id`      | Cursor-paginated history             |
| POST   | `/api/messages/conversations/:id`      | Send text message                    |
| PATCH  | `/api/messages/:messageId`             | Edit (sender only)                   |
| DELETE | `/api/messages/:messageId`             | Soft-delete (sender or moderator)    |
| GET    | `/api/friends`                         | List friendships (`?status=`)        |
| POST   | `/api/friends/requests`                | Send friend request                  |
| PATCH  | `/api/friends/requests/:id`            | Accept / decline                     |
| DELETE | `/api/friends/:friendId`               | Remove friend                        |

Errors use the shape `{ error: { code, message, details? } }`.

## Socket.IO

Connect with the access token in the handshake:

```ts
const socket = io('http://localhost:3000', { auth: { token: accessToken } });
```

**Server → client** events: `conversation:new`, `conversation:updated`, `conversation:member-left`,
`conversation:deleted`, `message:new`, `message:updated`, `message:deleted`, `messages:read`,
`typing`, `presence:update`, `friend:request`, `friend:response`, `friend:removed`.

**Client → server**: `typing` with `{ conversationId, typing: boolean }`.

## Environment variables

Copy `.env.example` → `.env`. Generate secrets with `openssl rand -hex 32`.
`DATABASE_URL` uses SQLite (`file:./dev.db`) by default; swap to `postgresql://...` for Postgres.
`CLIENT_ORIGIN` accepts `*` or a comma-separated list.

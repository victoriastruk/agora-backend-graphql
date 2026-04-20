# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun run docker:up          # Start PostgreSQL & Redis containers
bun run db:migrate         # Run database migrations
bun run dev                # Start dev server with watch mode

# Build & Check
bun run build              # Bundle to /dist
bun run type-check         # TypeScript type check (tsc --noEmit)
bun run lint               # Lint with oxlint
bun run lint:fix           # Auto-fix lint + format issues
bun run fmt:check          # Check formatting

# Testing
bun run test               # Run all tests
bun run test:unit          # Unit tests only
bun run test:integration   # Integration tests only
bun test path/to/file.test.ts                          # Single test file
bun test --testNamePattern="description of test"       # Single test by name
```

## Architecture

**Agora** is a Reddit-like community platform. The backend uses two API surfaces:
- **REST** (`/auth/*`) — authentication only (register, login, logout, refresh, Google OAuth)
- **GraphQL** (`/graphql`) — all data operations (communities, posts, comments, votes, reports)

### Layer overview

| Layer | Location | Role |
|---|---|---|
| HTTP framework | `src/app.ts`, `src/plugins/` | Elysia.js app bootstrap, CORS, error handling, logging |
| REST controllers | `src/controllers/` | JWT auth flow, Google OAuth |
| GraphQL | `src/graphql/schema.ts` + `resolvers.ts` | GraphQL Yoga — type defs and all Query/Mutation/Subscription resolvers |
| DB queries | `src/db/queries/` | Drizzle ORM query builders, grouped by domain (communities, posts, comments, …) |
| DB schema | `src/db/schema.ts` | Drizzle table definitions (source of truth for all entities) |
| Cache / realtime | `src/db/redis.ts` | ioredis; PubSub events: `POST_ADDED`, `POST_UPDATED`, `POST_VOTED`, `COMMENT_ADDED`, `COMMENT_VOTED` |
| Auth utilities | `src/utils/auth.ts` | JWT (jose), argon2 password hashing, session management |
| Config | `src/shared/config/env.ts` | Zod-validated environment variables |

### Key patterns

- **GraphQL context** carries `userId` (injected from session/JWT) and is the primary auth mechanism inside resolvers — unauthenticated/forbidden errors use GraphQL error extensions.
- **Drizzle DB client** (`src/db/client.ts`) is initialized lazily via a Proxy to avoid connecting before the app is ready.
- **Migrations** live in `/drizzle/` and are managed with `drizzle-kit`. Run `bun run db:migrate` after schema changes.
- **Git hooks** (Lefthook) enforce lint, typecheck, and no-debug-statement checks on pre-commit, and conventional commits via commitlint on commit-msg.

### Tech stack

- **Runtime/framework:** Bun + Elysia.js
- **Database:** PostgreSQL 16 via Drizzle ORM + postgres.js (pool max 10)
- **Cache:** Redis 7 via ioredis
- **GraphQL server:** GraphQL Yoga + @graphql-tools/schema
- **Auth:** jose (JWT), argon2, Google OAuth
- **Validation:** Zod (env vars), TypeScript strict mode
- **Logging:** Pino (structured JSON)
- **Linting/formatting:** oxlint + oxfmt (printWidth: 100)
- **Tests:** Bun test runner (vitest-compatible API), in `tests/unit/` and `tests/integration/`

### Environment

Copy `.env.example` to `.env`. Key variables: `PORT` (default 4000), `DATABASE_URL`, `REDIS_URL`, JWT secrets, `CORS_ORIGIN`. Integration tests use a separate `.env.test`.

### Cross-Repo Integration

- **Frontend Partner**: This backend serves the `agora-client` repository.
- **Contract**:
  - Auth: REST API via Elysia.js (shared sessions via cookies).
  - Data: GraphQL Yoga (schema source of truth).
- **Communication**: When making schema changes, remind the user to run `bun run codegen:gql` in the client repo to sync types.
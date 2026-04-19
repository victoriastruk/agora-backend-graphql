# Agora Backend API

Agora backend API built with Elysia.js, TypeScript, PostgreSQL, and Redis.

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Docker](https://www.docker.com/) and Docker Compose
- Node.js (for some development tools)

### Full Development Environment

Start full local environment:

```bash
bun run docker:up
bun run db:migrate
bun run dev
```

This will:

- ✅ Start PostgreSQL and Redis containers
- ✅ Run database migrations
- ✅ Start the development server


## 🛑 Stopping Services

Stop Docker services:

```bash
bun run docker:down
```

## 📚 API Endpoints

Once running, the API will be available at:

- **Server:** http://localhost:${PORT} (default 4000)
- **API Docs:** http://localhost:${PORT}/docs
- **GraphQL Playground:** http://localhost:${PORT}/graphql
- **Health Check:** http://localhost:${PORT}/health

### GraphQL API

**Primary API** - use GraphQL for all operations except authentication.

- **Endpoint:** `POST /graphql`
- **Playground:** `GET /graphql` (open in browser)

GraphQL API includes:

- ✅ Queries for reading data
- ✅ Mutations for changing data
- ✅ Subscriptions for real-time updates
- ✅ Full support for Communities, Posts, Comments, Votes

### REST API (Authentication Only)

⚠️ **Only auth endpoints remain on REST**. All other operations are available via GraphQL API.

Auth endpoints:

- `POST /auth/register` - Register a user
- `POST /auth/login` - Log in
- `POST /auth/logout` - Log out
- `GET /auth/me` - Get current user info
- `GET /api/auth/google` - Start Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback

Health check:

- `GET /health` - Check server health

## 🗄️ Database

- **PostgreSQL:** Container on port 5432
- **Redis:** Container on port 6379
- **Migrations:** Automatic with `bun run db:migrate`

## 🛠️ Available Scripts

| Command                  | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `bun run dev`            | Start development server                         |
| `bun run start:docker`   | Start local services via helper script           |
| `bun run stop:docker`    | Stop local services via helper script            |
| `bun run docker:up`      | Start Docker services (PostgreSQL + Redis)       |
| `bun run docker:down`    | Stop Docker services                             |
| `bun run docker:logs`    | Stream Docker logs                               |
| `bun run db:migrate`     | Run database migrations                          |
| `bun run db:generate`    | Generate new migrations                          |
| `bun run db:push`        | Push schema changes directly to database         |
| `bun run db:studio`      | Open Drizzle Studio                              |
| `bun run db:seed`        | Seed database with initial data                  |
| `bun run lint`           | Run linter                                       |
| `bun run lint:aware`     | Run type-aware linting                           |
| `bun run lint:fix`       | Auto-fix lint issues and format code             |
| `bun run fmt`            | Format code                                      |
| `bun run fmt:check`      | Check formatting without changing files          |
| `bun run type-check`     | Run TypeScript type checking                     |
| `bun run test`           | Run all tests                                    |
| `bun run test:watch`     | Run tests in watch mode                          |
| `bun run test:unit`      | Run unit tests                                   |
| `bun run test:integration` | Run integration tests                          |
| `bun run test:coverage`  | Run tests with coverage report                   |
| `bun run build`          | Build for production                             |
| `bun run start`          | Start production build                           |

## 🔧 Troubleshooting

### Port Conflicts

If port 5432 or 6379 are already in use:

- Check what's using the ports: `lsof -i :5432`
- Stop conflicting services
- Or modify `docker-compose.yml` to use different ports

## 📁 Project Structure

```
src/
├── app.ts                 # Main application entry
├── constants/             # Application constants
├── controllers/           # Route controllers
├── db/                    # Database configuration & schemas
├── graphql/               # GraphQL resolvers & schema
├── plugins/               # Elysia plugins
├── routes/                # API routes
├── shared/                # Shared utilities & config
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions

scripts/                   # Startup/stop scripts
drizzle/                   # Database migrations
```

## 🧪 Development

### Code Quality

- **Linting:** `bun run lint`
- **Type Checking:** `bun run type-check`
- **Formatting:** `bun run fmt`

### Database Management

- **View Schema:** `bun run db:studio`
- **Reset Database:** `bun run docker:down` then `bun run docker:up`

## 📦 Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Framework:** [Elysia.js](https://elysiajs.com/)
- **Database:** PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Cache:** Redis
- **Language:** TypeScript
- **Container:** Docker & Docker Compose
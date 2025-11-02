# Reddit Backend API

A modern Reddit backend API built with Elysia.js, TypeScript, PostgreSQL, and Redis.

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Docker](https://www.docker.com/) and Docker Compose
- Node.js (for some development tools)

### Full Development Environment

Start everything with one command:

```bash
bun run dev:full
```

This will:

- ✅ Start PostgreSQL and Redis containers
- ✅ Wait for services to be ready
- ✅ Run database migrations
- ✅ Start the development server

### Manual Startup

If you prefer to start services individually:

1. **Start databases:**

   ```bash
   bun run docker:up
   ```

2. **Run migrations:**

   ```bash
   bun run db:migrate
   ```

3. **Start server:**
   ```bash
   bun run dev
   ```

## 🛑 Stopping Services

Stop all services:

```bash
bun run stop
```

## 📚 API Endpoints

Once running, the API will be available at:

- **Server:** http://localhost:5555
- **API Docs:** http://localhost:5555/docs
- **GraphQL Playground:** http://localhost:5555/graphql
- **Health Check:** http://localhost:5555/health

## 🗄️ Database

- **PostgreSQL:** Container on port 5432
- **Redis:** Container on port 6379
- **Migrations:** Automatic with `bun run db:migrate`

## 🛠️ Available Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `bun run dev`         | Start development server only        |
| `bun run dev:full`    | Start all services (Docker + Server) |
| `bun run stop`        | Stop all services                    |
| `bun run db:migrate`  | Run database migrations              |
| `bun run db:generate` | Generate new migrations              |
| `bun run docker:up`   | Start Docker services                |
| `bun run docker:down` | Stop Docker services                 |
| `bun run lint`        | Run linter                           |
| `bun run build`       | Build for production                 |

## 🔧 Troubleshooting

### PostgreSQL Connection Issues

If you get "role 'postgres' does not exist" errors:

```bash
# Stop local PostgreSQL (if running)
bun run postgres:stop

# Or manually:
brew services stop postgresql@18
```

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
├── middleware/            # Custom middleware
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
- **Formatting:** `bun run format`

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

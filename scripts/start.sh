#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

POSTGRES_CONTAINER=${POSTGRES_CONTAINER:-reddit-postgres}
REDIS_CONTAINER=${REDIS_CONTAINER:-hub-redis}
DEFAULT_PORT=5555
MAX_POSTGRES_ATTEMPTS=30
MAX_REDIS_ATTEMPTS=10

SKIP_MIGRATIONS=false
NO_DOCKER=false

for arg in "$@"; do
  case $arg in
    --skip-migrations) SKIP_MIGRATIONS=true ;;
    --no-docker) NO_DOCKER=true ;;
  esac
done

section() {
  echo ""
  echo -e "${BLUE}==> $1${NC}"
}

check_docker() {
  if $NO_DOCKER; then
    echo -e "${YELLOW}⚠️  Skipping Docker startup (--no-docker)${NC}"
    return
  fi

  if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
  fi
}

start_docker_services() {
  if $NO_DOCKER; then return; fi

  section "📦 Starting Docker services (PostgreSQL + Redis)..."
  docker compose up -d

  if ! docker compose ps | grep -q "Up"; then
    echo -e "${RED}❌ Some Docker services failed to start${NC}"
    docker compose ps
    exit 1
  fi
}

check_local_postgres() {
  if pgrep -f "postgres.*5432" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Local PostgreSQL detected on port 5432${NC}"
    echo -e "${YELLOW}   This may conflict with Docker PostgreSQL.${NC}"
    echo -e "${YELLOW}   Consider stopping it: brew services stop postgresql@14${NC}"
    echo ""
  fi
}

wait_for_postgres() {
  if $NO_DOCKER; then return; fi
  section "⏳ Waiting for PostgreSQL to be ready..."

  for ((attempt=1; attempt<=MAX_POSTGRES_ATTEMPTS; attempt++)); do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U postgres -d reddit-server >/dev/null 2>&1; then
      echo -e "${GREEN}✅ PostgreSQL is ready!${NC}"
      return
    fi
    echo "Attempt $attempt/$MAX_POSTGRES_ATTEMPTS: PostgreSQL not ready yet..."
    sleep 2
  done

  echo -e "${RED}❌ PostgreSQL failed to start within expected time${NC}"
  echo -e "${YELLOW}💡 Check logs: docker logs $POSTGRES_CONTAINER${NC}"
  exit 1
}

wait_for_redis() {
  if $NO_DOCKER; then return; fi
  section "⏳ Waiting for Redis to be ready..."

  for ((attempt=1; attempt<=MAX_REDIS_ATTEMPTS; attempt++)); do
    if docker exec "$REDIS_CONTAINER" redis-cli ping >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Redis is ready!${NC}"
      return
    fi
    echo "Attempt $attempt/$MAX_REDIS_ATTEMPTS: Redis not ready yet..."
    sleep 1
  done

  echo -e "${RED}❌ Redis failed to start within expected time${NC}"
  echo -e "${YELLOW}💡 Check logs: docker logs $REDIS_CONTAINER${NC}"
  exit 1
}

run_migrations() {
  if $SKIP_MIGRATIONS; then
    echo -e "${YELLOW}⚠️  Skipping migrations (--skip-migrations)${NC}"
    return
  fi

  section "🗄️ Running database migrations..."
  if ! bun run db:migrate; then
    echo -e "${RED}❌ Database migration failed${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ Database migration completed!${NC}"
}

get_port() {
  if [ -f .env ]; then
    PORT=$(grep -E '^PORT=' .env | sed 's/^PORT=//;s/"//g' | tr -d '[:space:]')
  fi
  PORT=${PORT:-$DEFAULT_PORT}
  echo "$PORT"
}

start_server() {
  local port
  port=$(get_port)

  section "🌟 Starting development server..."
  echo -e "${BLUE}📍 Server: http://localhost:$port${NC}"
  echo -e "${BLUE}📚 API Docs: http://localhost:$port/docs${NC}"
  echo -e "${BLUE}🔗 GraphQL: http://localhost:$port/graphql${NC}"
  echo -e "${BLUE}❤️ Health: http://localhost:$port/health${NC}"
  echo ""

  exec bun run dev
}

main() {
  echo "🚀 Starting Reddit Backend API Server..."
  start_time=$(date +%s)

  check_docker
  check_local_postgres
  start_docker_services
  wait_for_postgres
  wait_for_redis
  run_migrations
  start_server

  end_time=$(date +%s)
  echo -e "${GREEN}✅ Startup completed in $((end_time - start_time))s!${NC}"
}

main "$@"

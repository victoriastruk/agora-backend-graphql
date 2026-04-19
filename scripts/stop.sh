#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No color

DEFAULT_PORT=5555
POSTGRES_CONTAINER=${POSTGRES_CONTAINER:-agora-postgres}
REDIS_CONTAINER=${REDIS_CONTAINER:-hub-redis}
NO_DOCKER=false

for arg in "$@"; do
  case $arg in
    --no-docker) NO_DOCKER=true ;;
  esac
done

section() {
  echo ""
  echo -e "${BLUE}==> $1${NC}"
}

get_port() {
  if [ -f .env ]; then
    PORT=$(grep -E '^PORT=' .env | sed 's/^PORT=//;s/"//g' | tr -d '[:space:]')
  fi
  PORT=${PORT:-$DEFAULT_PORT}
  echo "$PORT"
}

kill_port() {
  local port=$1
  local name=$2

  local pid
  pid=$(lsof -ti ":$port" 2>/dev/null || true)

  if [ -n "${pid:-}" ]; then
    echo -e "${YELLOW}🔻 Stopping $name (PID: $pid)...${NC}"
    kill "$pid" 2>/dev/null || true

    # Wait a bit for graceful shutdown
    sleep 2

    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${RED}⚠️  Force killing $name...${NC}"
      kill -9 "$pid" 2>/dev/null || true
    fi

    echo -e "${GREEN}✅ $name stopped${NC}"
  else
    echo -e "${BLUE}ℹ️  No $name process found on port $port${NC}"
  fi
}

stop_docker() {
  if $NO_DOCKER; then
    echo -e "${YELLOW}⚠️  Skipping Docker shutdown (--no-docker)${NC}"
    return
  fi

  section "📦 Stopping Docker services..."
  if docker compose ps >/dev/null 2>&1; then
    docker compose down
    echo -e "${GREEN}✅ Docker services stopped${NC}"
  else
    echo -e "${BLUE}ℹ️  No Docker Compose project found${NC}"
  fi
}

stop_specific_containers() {
  for container in "$POSTGRES_CONTAINER" "$REDIS_CONTAINER"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
      echo -e "${YELLOW}Stopping container: $container${NC}"
      docker stop "$container" >/dev/null 2>&1 || true
    fi
  done
}

main() {
  echo "🛑 Stopping Agora Backend API Server..."
  echo ""

  local port
  port=$(get_port)

  section "💀 Stopping development server..."
  kill_port "$port" "development server"
    
  stop_docker

  stop_specific_containers

  echo ""
  echo -e "${GREEN}✅ All services stopped successfully!${NC}"
  echo ""
  echo -e "${BLUE}💡 To start again, run: ./start.sh${NC}"
}

main "$@"

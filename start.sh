#!/bin/bash

# Taybullpay - Start All Services
# Usage: ./start.sh [local|docker|stop|status]

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GISP_DIR="$(cd "$SCRIPT_DIR/../Gisp" && pwd)"

print_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║         ${GREEN}Taybullpay${CYAN} - Core Banking System     ║${NC}"
  echo -e "${CYAN}║              GMD • The Gambia                ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
}

start_docker() {
  print_banner
  echo -e "${YELLOW}Starting full stack with Docker...${NC}"
  echo ""

  # Check Docker
  if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Please start Docker Desktop first.${NC}"
    echo "  open -a Docker"
    exit 1
  fi

  cd "$SCRIPT_DIR"
  docker compose up -d --build

  echo ""
  echo -e "${YELLOW}Waiting for services to stabilize...${NC}"
  sleep 20

  # Restart connector for fresh DNS
  docker compose restart gisp-connector > /dev/null 2>&1
  sleep 5

  echo ""
  echo -e "${GREEN}All services started!${NC}"
  echo ""
  echo -e "  ${CYAN}Taybullpay UI${NC}      http://localhost:8080"
  echo -e "  ${CYAN}TTK UI${NC}             http://localhost:6060"
  echo -e "  ${CYAN}TTK API${NC}            http://localhost:4040"
  echo -e "  ${CYAN}Gisp Connector${NC}     http://localhost:3003 / :3004"
  echo -e "  ${CYAN}SDK Adapter${NC}        http://localhost:4000 / :4001"
  echo -e "  ${CYAN}PostgreSQL${NC}         localhost:5432"
  echo ""
  echo -e "  ${GREEN}Test accounts:${NC}"
  echo "    7788255  Ebrima Sawaneh    (5,000 GMD)"
  echo "    9960268  Essa Jabang       (12,000 GMD)"
  echo "    3182122  Abubacarr Mahmoud (8,500 GMD)"
  echo "    5401992  Fanta Ceesay      (50,000 GMD)"
  echo ""
}

start_local() {
  print_banner
  echo -e "${YELLOW}Starting local services (no Docker)...${NC}"
  echo ""

  # Check PostgreSQL
  if ! pg_isready > /dev/null 2>&1; then
    echo -e "${RED}PostgreSQL is not running. Please start it first.${NC}"
    exit 1
  fi

  # Kill any existing processes on our ports
  for port in 8080 3003 3004; do
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null
  done
  sleep 1

  # Start Taybullpay API
  echo -e "${CYAN}[1/2] Starting Taybullpay API on :8080${NC}"
  cd "$SCRIPT_DIR"
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taybullpay \
  API_KEY=test-key API_SECRET=test-secret PORT=8080 \
  node dist/index.js > /tmp/taybullpay.log 2>&1 &
  echo $! > /tmp/taybullpay.pid
  sleep 3

  # Start Gisp Connector
  echo -e "${CYAN}[2/2] Starting Gisp Connector on :3003/:3004${NC}"
  cd "$GISP_DIR"
  export $(cat .env | xargs) 2>/dev/null
  CBS_BASE_URL=http://localhost:8080/api CBS_API_KEY=test-key CBS_API_SECRET=test-secret \
  node dist/index.js > /tmp/gisp-connector.log 2>&1 &
  echo $! > /tmp/gisp-connector.pid
  sleep 3

  echo ""
  echo -e "${GREEN}Services started!${NC}"
  echo ""
  echo -e "  ${CYAN}Taybullpay UI${NC}      http://localhost:8080"
  echo -e "  ${CYAN}Gisp Connector${NC}     http://localhost:3003 / :3004"
  echo ""
  echo -e "  ${YELLOW}Note:${NC} Send Money via Mojaloop requires Docker (./start.sh docker)"
  echo -e "  ${YELLOW}Logs:${NC} tail -f /tmp/taybullpay.log /tmp/gisp-connector.log"
  echo ""
}

stop_all() {
  print_banner
  echo -e "${YELLOW}Stopping all services...${NC}"

  # Stop local processes
  if [ -f /tmp/taybullpay.pid ]; then
    kill $(cat /tmp/taybullpay.pid) 2>/dev/null
    rm /tmp/taybullpay.pid
    echo "  Stopped Taybullpay API"
  fi
  if [ -f /tmp/gisp-connector.pid ]; then
    kill $(cat /tmp/gisp-connector.pid) 2>/dev/null
    rm /tmp/gisp-connector.pid
    echo "  Stopped Gisp Connector"
  fi

  # Kill any stragglers
  for port in 8080 3003 3004; do
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null
  done

  # Stop Docker
  if docker info > /dev/null 2>&1; then
    cd "$SCRIPT_DIR"
    docker compose down 2>/dev/null
    echo "  Stopped Docker containers"
  fi

  echo ""
  echo -e "${GREEN}All services stopped.${NC}"
  echo ""
}

show_status() {
  print_banner
  echo -e "${CYAN}Service Status:${NC}"
  echo ""

  check_port() {
    if curl -s --max-time 2 -o /dev/null "http://localhost:$1" 2>/dev/null; then
      echo -e "  ${GREEN}[UP]${NC}   $2 (port $1)"
    else
      echo -e "  ${RED}[DOWN]${NC} $2 (port $1)"
    fi
  }

  check_port 8080 "Taybullpay API"
  check_port 3003 "Gisp Connector (SDK)"
  check_port 3004 "Gisp Connector (DFSP)"
  check_port 6060 "TTK UI"
  check_port 4040 "TTK Backend"
  check_port 4001 "SDK Scheme Adapter"

  if pg_isready > /dev/null 2>&1; then
    echo -e "  ${GREEN}[UP]${NC}   PostgreSQL (port 5432)"
  else
    echo -e "  ${RED}[DOWN]${NC} PostgreSQL (port 5432)"
  fi

  if docker info > /dev/null 2>&1; then
    echo ""
    echo -e "${CYAN}Docker Containers:${NC}"
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps --format "  {{.Name}}: {{.Status}}" 2>/dev/null
  fi
  echo ""
}

# Main
case "${1:-docker}" in
  local)
    start_local
    ;;
  docker)
    start_docker
    ;;
  stop)
    stop_all
    ;;
  status)
    show_status
    ;;
  *)
    echo "Usage: ./start.sh [local|docker|stop|status]"
    echo ""
    echo "  local   - Start Taybullpay + Gisp locally (no Docker)"
    echo "  docker  - Start full stack with Docker (default)"
    echo "  stop    - Stop all services"
    echo "  status  - Check service status"
    ;;
esac

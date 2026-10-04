#!/usr/bin/env bash
###############################################################################
# BRICKFARM UNIFIED DEV LAUNCHER
# 
# This script starts the entire BrickFarm stack:
#   - Docker services (Postgres + Redis)
#   - Backend (FastAPI on port 8000)
#   - Frontend (Vite on port 5173)
#
# Usage: ./launch.sh [--backend-only | --frontend-only]
###############################################################################

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend-web"
VENV_DIR="${BACKEND_VENV:-.venv}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

docker_compose() {
  if command -v docker-compose &> /dev/null; then
    docker-compose "$@"
  elif docker compose version &> /dev/null; then
    docker compose "$@"
  else
    return 127
  fi
}

container_running() {
  docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -q true
}

container_exists() {
  docker inspect "$1" >/dev/null 2>&1
}

start_docker_direct() {
  log_warn "Docker Compose not found; starting db/redis with docker run"

  if container_running brickfarm-db; then
    log_info "brickfarm-db is already running"
  elif container_exists brickfarm-db; then
    docker start brickfarm-db >/dev/null
  else
    docker volume create brickfarm_db_data_dev >/dev/null
    docker run -d --name brickfarm-db \
      -e POSTGRES_USER=brickfarm \
      -e POSTGRES_PASSWORD=brickfarm_pass \
      -e POSTGRES_DB=brickfarm \
      -p 5433:5432 \
      -v brickfarm_db_data_dev:/var/lib/postgresql/data \
      postgis/postgis:14-3.4 >/dev/null
  fi

  if container_running brickfarm-redis; then
    log_info "brickfarm-redis is already running"
  elif container_exists brickfarm-redis; then
    docker start brickfarm-redis >/dev/null
  else
    docker run -d --name brickfarm-redis -p 6380:6379 redis:7 >/dev/null
  fi
}

# Parse arguments
BACKEND_ONLY=0
FRONTEND_ONLY=0
for arg in "$@"; do
  case $arg in
    --backend-only) BACKEND_ONLY=1 ;;
    --frontend-only) FRONTEND_ONLY=1 ;;
    *) log_error "Unknown argument: $arg"; exit 1 ;;
  esac
done

###############################################################################
# PHASE 1: START DOCKER SERVICES
###############################################################################
start_docker_services() {
  log_info "Starting Docker services (Postgres + Redis)..."
  cd "$BACKEND_DIR"
  
  if ! command -v docker &> /dev/null; then
    log_error "Docker not found. Install Docker first."
    exit 1
  fi
  
  if ! docker_compose up -d db redis; then
    start_docker_direct || {
      log_error "Failed to start Docker services"
      exit 1
    }
  fi
  
  # Wait for Postgres to be ready
  log_info "Waiting for Postgres to be ready on port 5433..."
  local max_attempts=30
  local attempt=0
  until docker exec brickfarm-db pg_isready -U brickfarm >/dev/null 2>&1 || docker_compose exec -T db pg_isready -U brickfarm >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
      log_error "Postgres failed to start after $max_attempts attempts"
      exit 1
    fi
    sleep 1
  done
  log_info "✓ Postgres is ready"
  
  # Wait for Redis
  log_info "Waiting for Redis to be ready on port 6380..."
  until docker exec brickfarm-redis redis-cli ping >/dev/null 2>&1 || docker_compose exec -T redis redis-cli ping >/dev/null 2>&1; do
    sleep 1
  done
  log_info "✓ Redis is ready"
}

###############################################################################
# PHASE 2: SETUP BACKEND PYTHON ENVIRONMENT
###############################################################################
setup_backend_env() {
  log_info "Setting up Python environment for backend..."
  cd "$BACKEND_DIR"
  
  # Create venv if it doesn't exist
  if [ ! -d "$VENV_DIR" ] && [ -d .venv_test ]; then
    VENV_DIR=.venv_test
    log_info "Using existing backend virtual environment: .venv_test"
  fi

  if [ ! -d "$VENV_DIR" ]; then
    log_info "Creating virtual environment..."
    python3 -m venv "$VENV_DIR" || {
      log_error "Failed to create venv. Ensure python3 is installed."
      exit 1
    }
  fi
  
  # Activate venv and install dependencies
  source "$VENV_DIR/bin/activate"
  if [ "$VENV_DIR" != ".venv_test" ]; then
    log_info "Upgrading pip..."
    pip install --upgrade pip setuptools wheel >/dev/null 2>&1 || {
      log_error "Failed to upgrade pip"
      exit 1
    }
    
    log_info "Installing backend dependencies..."
    pip install -r requirements.txt >/dev/null 2>&1 || {
      log_error "Failed to install dependencies from requirements.txt"
      exit 1
    }
  fi
  
  log_info "✓ Python environment ready"
}

###############################################################################
# PHASE 3: RUN DATABASE MIGRATIONS
###############################################################################
run_migrations() {
  log_info "Running database migrations..."
  cd "$BACKEND_DIR"
  
  source "$VENV_DIR/bin/activate"
  
  # Run alembic upgrade
  if ! alembic upgrade head; then
    log_error "Database migrations failed"
    exit 1
  fi
  
  log_info "✓ Migrations complete"
}

###############################################################################
# PHASE 4: START BACKEND
###############################################################################
start_backend() {
  log_info "Starting FastAPI backend on http://0.0.0.0:8000..."
  cd "$BACKEND_DIR"
  
  source "$VENV_DIR/bin/activate"
  
  # Start uvicorn
  exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level info
}

###############################################################################
# PHASE 5: SETUP FRONTEND ENVIRONMENT
###############################################################################
setup_frontend_env() {
  log_info "Setting up frontend environment..."
  cd "$FRONTEND_DIR"
  
  if [ ! -f "yarn.lock" ] && [ ! -f "package-lock.json" ]; then
    log_info "Installing frontend dependencies (this may take a minute)..."
    if command -v yarn &> /dev/null; then
      yarn install >/dev/null 2>&1 || {
        log_error "Failed to install frontend dependencies with yarn"
        exit 1
      }
    elif command -v npm &> /dev/null; then
      npm install >/dev/null 2>&1 || {
        log_error "Failed to install frontend dependencies with npm"
        exit 1
      }
    else
      log_error "Neither yarn nor npm found. Install Node.js and npm/yarn."
      exit 1
    fi
  else
    log_info "Frontend dependencies already installed"
  fi
  
  log_info "✓ Frontend environment ready"
}

###############################################################################
# PHASE 6: START FRONTEND
###############################################################################
start_frontend() {
  log_info "Starting Vite frontend on http://localhost:5173..."
  cd "$FRONTEND_DIR"
  
  export VITE_API_URL="http://localhost:8000/api/v1"
  
  if command -v yarn &> /dev/null; then
    exec yarn dev
  else
    exec npm run dev
  fi
}

###############################################################################
# MAIN EXECUTION
###############################################################################

# Always start Docker services first
start_docker_services

if [ $BACKEND_ONLY -eq 1 ]; then
  log_info "Running backend only..."
  setup_backend_env
  run_migrations
  start_backend
elif [ $FRONTEND_ONLY -eq 1 ]; then
  log_info "Running frontend only (ensure backend is running separately)..."
  setup_frontend_env
  start_frontend
else
  # Start both backend and frontend
  log_info "Starting full BrickFarm stack..."
  
  # Setup backend
  setup_backend_env
  run_migrations
  
  # Setup frontend
  setup_frontend_env
  
  # Start backend in background
  log_info "Starting backend in background..."
  cd "$BACKEND_DIR"
  source "$VENV_DIR/bin/activate"
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level info > /tmp/brickfarm-backend.log 2>&1 &
  BACKEND_PID=$!
  log_info "Backend PID: $BACKEND_PID"
  
  # Give backend time to start
  sleep 3
  
  # Test backend health
  if curl -s http://localhost:8000/healthz >/dev/null; then
    log_info "✓ Backend is responding"
  else
    log_warn "Backend health check failed; it may still be starting..."
  fi
  
  # Start frontend (in foreground)
  log_info ""
  log_info "======================================================================"
  log_info "✓ BrickFarm is running!"
  log_info "======================================================================"
  log_info ""
  log_info "Frontend:  http://localhost:5173"
  log_info "Backend:   http://localhost:8000"
  log_info "API Docs:  http://localhost:8000/docs"
  log_info "DB:        localhost:5433 (postgres://brickfarm:brickfarm_pass@127.0.0.1:5433/brickfarm)"
  log_info ""
  log_info "Backend logs: tail -f /tmp/brickfarm-backend.log"
  log_info ""
  log_info "To stop all services: Ctrl+C (frontend), then docker-compose down"
  log_info "======================================================================"
  log_info ""
  
  start_frontend
fi

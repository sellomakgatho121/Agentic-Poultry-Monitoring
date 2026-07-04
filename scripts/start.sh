#!/usr/bin/env bash
# ============================================================================
# Boonducks Farm PLF Engine — Local Development Startup Script
# ============================================================================
#
# Usage:  bash scripts/start.sh [--mode=live|sim]
#
# Starts the API server and optionally the Python workers.
# By default runs in sim mode (no database required).
#
# NOTE: Requires Node.js 18+ and Python 3.10+.
#       On first run, install deps with: bash scripts/setup.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# --- Parse args ---
MODE="${1:-sim}"
if [[ "$MODE" =~ ^--mode=(.+) ]]; then
    MODE="${BASH_REMATCH[1]}"
fi

echo "========================================"
echo " Boonducks Farm PLF Engine — Dev Mode"
echo "========================================"
echo " Mode:        $MODE"
echo " Project dir: $PROJECT_DIR"
echo ""

# --- Check prerequisites ---
if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is not installed. Install Node.js 18+ first."
    exit 1
fi

NODE_VER="$(node --version | cut -d. -f1 | tr -d v)"
if [ "$NODE_VER" -lt 18 ]; then
    echo "ERROR: Node.js 18+ required (found v$(node --version))."
    exit 1
fi

# --- Install backend dependencies if missing ---
if [ ! -d node_modules ]; then
    echo "Installing Node.js dependencies..."
    npm ci --no-audit --no-fund
fi

# --- Export environment ---
export MODE="$MODE"
export PORT="${PORT:-5000}"
export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-boonducks_plf}"
export DB_USER="${DB_USER:-postgres}"
export DB_PASSWORD="${DB_PASSWORD:-postgres}"

# --- Health check function ---
wait_for_api() {
    local retries=30
    local interval=1
    echo "Waiting for API to be ready..."
    for i in $(seq 1 $retries); do
        if curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
            echo "API ready!"
            return 0
        fi
        sleep "$interval"
    done
    echo "WARNING: API did not respond within $((retries * interval)) seconds."
    return 1
}

# --- Start API server ---
echo "Starting API server on port ${PORT} (MODE=${MODE})..."
node server.js &
API_PID=$!
echo "API PID: $API_PID"

# --- Optional: Start API tests ---
if [ "${RUN_TESTS:-}" = "1" ]; then
    wait_for_api || true
    echo "Running API tests..."
    npm test
fi

# --- Optional: Start Python workers ---
if [ "${RUN_WORKERS:-}" = "1" ]; then
    echo "Starting Python AI workers..."

    # Activate venv if available
    if [ -d .venv ]; then
        source .venv/bin/activate
    fi

    python3 telemetry_worker.py &
    WORKER_PID=$!
    echo "Telemetry worker PID: $WORKER_PID"

    if command -v python3 &>/dev/null; then
        python3 acoustic_analyzer.py &
        echo "Acoustic analyzer PID: $!"
    fi

    if command -v python3 &>/dev/null; then
        python3 vision_analyzer.py &
        echo "Vision analyzer PID: $!"
    fi
fi

# --- Trap and cleanup ---
cleanup() {
    echo ""
    echo "Shutting down..."
    kill "$API_PID" 2>/dev/null || true
    [ -n "${WORKER_PID:-}" ] && kill "$WORKER_PID" 2>/dev/null || true
    echo "All processes stopped."
}
trap cleanup EXIT INT TERM

echo ""
echo "========================================"
echo " System running. Press Ctrl+C to stop."
echo "========================================"
echo " API:    http://localhost:${PORT}/api/health"
echo " Coops:  http://localhost:${PORT}/api/coops"
echo " Live:   http://localhost:${PORT}/api/telemetry/live"
echo ""

# Wait for API process
wait "$API_PID"

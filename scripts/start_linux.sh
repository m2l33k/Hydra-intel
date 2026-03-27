#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HYDRA INTEL — Linux Launcher
# Usage: bash scripts/start_linux.sh
# ═══════════════════════════════════════════════════════════════

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "══════════════════════════════════════════════"
echo "  HYDRA INTEL — Starting Platform"
echo "══════════════════════════════════════════════"
echo ""

# Start Tor if available
if command -v tor &>/dev/null; then
    echo "[*] Starting Tor..."
    sudo tor &>/dev/null &
    sleep 2
    echo "[+] Tor started"
fi

# Start backend
echo "[*] Starting backend on :8000..."
python3 run_server.py &
BACKEND_PID=$!
sleep 2

# Start frontend
echo "[*] Starting frontend on :3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

echo ""
echo "══════════════════════════════════════════════"
echo "  HYDRA INTEL — Running"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"
echo "══════════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop..."

# Cleanup on exit
cleanup() {
    echo ""
    echo "[*] Stopping..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "[+] Stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM

wait

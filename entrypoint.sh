#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HYDRA INTEL — Entrypoint
# ═══════════════════════════════════════════════════════════════

echo "══════════════════════════════════════════════"
echo "  HYDRA INTEL — Starting Platform"
echo "══════════════════════════════════════════════"

# Start Tor in background
if [ "${TOR_ENABLED:-true}" = "true" ]; then
    echo "[*] Starting Tor SOCKS proxy on :9050..."
    tor -f /etc/tor/torrc &
    sleep 2
    echo "[+] Tor started"
fi

# Initialize database (constructor does setup automatically)
echo "[*] Initializing database..."
python -c "
from storage.database import IntelDatabase
db = IntelDatabase()
print('[+] Database ready')
" 2>&1 || echo "[!] Database init failed (non-fatal)"

# Check tool availability
echo "[*] Checking tool availability..."
python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
results = tm.initialize()
available = sum(1 for s in results.values() if s == 'available')
total = len(results)
print(f'[+] Tools: {available}/{total} available')
" 2>&1 || echo "[!] Tool check failed (non-fatal)"

# Start backend API
echo "[*] Starting backend API on :8000..."
python run_server.py &
BACKEND_PID=$!
sleep 3

# Start frontend
if [ -d "/app/frontend/.next" ]; then
    echo "[*] Starting frontend on :3000..."
    cd /app/frontend
    npx next start -p 3000 &
    FRONTEND_PID=$!
    cd /app
else
    echo "[!] Frontend not built, skipping"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  HYDRA INTEL — Platform Ready"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"
echo "══════════════════════════════════════════════"
echo ""

# Keep container alive — wait for backend, restart if it dies
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "[!] Backend died, restarting..."
        python run_server.py &
        BACKEND_PID=$!
    fi
    sleep 10
done

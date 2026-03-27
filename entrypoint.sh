#!/bin/bash
set -e

echo "══════════════════════════════════════════════"
echo "  HYDRA INTEL — Starting Platform"
echo "══════════════════════════════════════════════"

# Start Tor in background (if enabled)
if [ "${TOR_ENABLED:-true}" = "true" ]; then
    echo "[*] Starting Tor SOCKS proxy on :9050..."
    tor -f /etc/tor/torrc &
    sleep 2
    echo "[+] Tor started"
fi

# Initialize database
echo "[*] Initializing database..."
python -c "
from storage.database import IntelDatabase
db = IntelDatabase()
db._initialize()
print('[+] Database ready at ${HYDRA_DB_PATH:-/app/data/intel.db}')
"

# Run tool availability check
echo "[*] Checking tool availability..."
python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
results = tm.initialize()
available = sum(1 for s in results.values() if s == 'available')
total = len(results)
print(f'[+] Tools: {available}/{total} available')
"

# Start backend API
echo "[*] Starting backend API on :8000..."
python run_server.py &
BACKEND_PID=$!
sleep 2

# Start frontend
if [ -d "/app/frontend/.next" ]; then
    echo "[*] Starting frontend on :3000..."
    cd /app/frontend
    npx next start -p 3000 &
    FRONTEND_PID=$!
    cd /app
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  HYDRA INTEL — Platform Ready"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"
echo "══════════════════════════════════════════════"
echo ""

# Wait for any process to exit
wait -n $BACKEND_PID ${FRONTEND_PID:-}

# Exit with the status of the first process that exits
exit $?

@echo off
echo ══════════════════════════════════════════════
echo   HYDRA INTEL — Windows Launcher
echo ══════════════════════════════════════════════
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python not found. Install from https://python.org
    pause
    exit /b 1
)

:: Check Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

:: Create venv if needed
if not exist "venv" (
    echo [*] Creating Python virtual environment...
    python -m venv venv
)

:: Activate venv and install deps
echo [*] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet 2>nul

:: Install frontend deps
echo [*] Installing frontend dependencies...
cd frontend
call npm install --prefer-offline --no-audit 2>nul
cd ..

:: Create .env if missing
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [+] Created .env from .env.example — edit it to add API keys
    )
)

:: Create data dirs
if not exist "logs" mkdir logs
if not exist "data" mkdir data

echo.
echo [*] Starting backend on http://localhost:8000 ...
start "HYDRA Backend" cmd /c "call venv\Scripts\activate.bat && python run_server.py"

echo [*] Starting frontend on http://localhost:3000 ...
start "HYDRA Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo ══════════════════════════════════════════════
echo   HYDRA INTEL — Running
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo   API Docs: http://localhost:8000/docs
echo ══════════════════════════════════════════════
echo.
echo Press any key to stop...
pause >nul

:: Kill backend and frontend
taskkill /FI "WINDOWTITLE eq HYDRA Backend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq HYDRA Frontend" /F >nul 2>&1
echo [+] Stopped.

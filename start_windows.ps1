# ═══════════════════════════════════════════════════════════════
# HYDRA INTEL — Windows PowerShell Launcher
# Usage: powershell -ExecutionPolicy Bypass -File start_windows.ps1
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  HYDRA INTEL -- Windows Launcher" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
$missing = @()
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { $missing += "Python (https://python.org)" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "Node.js (https://nodejs.org)" }

if ($missing.Count -gt 0) {
    Write-Host "[!] Missing prerequisites:" -ForegroundColor Red
    foreach ($m in $missing) { Write-Host "    - $m" -ForegroundColor Red }
    exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Create venv if needed
if (-not (Test-Path "venv")) {
    Write-Host "[*] Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate venv
& "$root\venv\Scripts\Activate.ps1"

# Install Python deps
Write-Host "[*] Installing Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet 2>$null

# Install frontend deps
Write-Host "[*] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location "$root\frontend"
npm install --prefer-offline --no-audit 2>$null
Set-Location $root

# Create .env if missing
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[+] Created .env from .env.example" -ForegroundColor Green
}

# Create dirs
New-Item -ItemType Directory -Force -Path "logs", "data" | Out-Null

Write-Host ""
Write-Host "[*] Starting backend on http://localhost:8000 ..." -ForegroundColor Cyan

# Start backend in background
$backend = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "call venv\Scripts\activate.bat && python run_server.py" -PassThru -WindowStyle Normal

Write-Host "[*] Starting frontend on http://localhost:3000 ..." -ForegroundColor Cyan

# Start frontend in background
$frontend = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd frontend && npm run dev" -PassThru -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  HYDRA INTEL -- Running" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C or close this window to stop..." -ForegroundColor Yellow

# Wait and cleanup
try {
    while ($true) { Start-Sleep -Seconds 5 }
} finally {
    Write-Host "`n[*] Stopping..." -ForegroundColor Yellow
    if ($backend -and !$backend.HasExited) { Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue }
    if ($frontend -and !$frontend.HasExited) { Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue }
    Write-Host "[+] Stopped." -ForegroundColor Green
}

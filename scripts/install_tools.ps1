# ═══════════════════════════════════════════════════════════════════════
# HYDRA INTEL - Full Tool Installation Script (Windows PowerShell)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\install_tools.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install_tools.ps1 -Mode check
#   powershell -ExecutionPolicy Bypass -File scripts\install_tools.ps1 -Mode test
# ═══════════════════════════════════════════════════════════════════════

param(
    [ValidateSet("all", "check", "pip", "go", "test")]
    [string]$Mode = "all"
)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$totalOk = 0
$totalFail = 0
$totalWarn = 0

function Write-OK($msg)   { Write-Host "  [OK]   $msg" -ForegroundColor Green;   $script:totalOk++ }
function Write-FAIL($msg)  { Write-Host "  [MISS] $msg" -ForegroundColor Red;     $script:totalFail++ }
function Write-WARN($msg)  { Write-Host "  [WARN] $msg" -ForegroundColor Yellow;  $script:totalWarn++ }
function Write-INFO($msg)  { Write-Host "  [*]    $msg" -ForegroundColor Cyan }

function Test-Cmd($name) {
    if (Get-Command $name -ErrorAction SilentlyContinue) {
        $path = (Get-Command $name).Source
        Write-OK "$name ($path)"
        return $true
    } else {
        Write-FAIL "$name"
        return $false
    }
}

function Test-PyModule($name) {
    $result = python -c "import $name" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK "python: $name"
        return $true
    } else {
        Write-FAIL "python: $name"
        return $false
    }
}

function Test-EnvVar($name) {
    $val = [Environment]::GetEnvironmentVariable($name)
    if (-not $val -and (Test-Path ".env")) {
        $line = Get-Content ".env" | Where-Object { $_ -match "^$name=(.+)" }
        if ($line -and $Matches[1]) { $val = $Matches[1] }
    }
    if ($val) {
        Write-OK "env: $name (set)"
        return $true
    } else {
        Write-WARN "env: $name (not set)"
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════
# INSTALL FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

function Install-Pip {
    Write-Host "`n=== Installing Python Packages ===" -ForegroundColor Cyan

    Write-INFO "Installing requirements.txt..."
    pip install -r requirements.txt 2>&1 | Select-Object -Last 5

    Write-Host ""
    Write-INFO "Installing optional OSINT packages..."

    $optional = @(
        @{ name = "requests";          pkg = "requests" },
        @{ name = "beautifulsoup4";    pkg = "beautifulsoup4" },
        @{ name = "praw";              pkg = "praw" },
        @{ name = "telethon";          pkg = "telethon" },
        @{ name = "pyrogram";          pkg = "pyrogram" },
        @{ name = "tgcrypto";          pkg = "tgcrypto" },
        @{ name = "shodan";            pkg = "shodan" },
        @{ name = "censys";            pkg = "censys" },
        @{ name = "python-nmap";       pkg = "python-nmap" },
        @{ name = "nvdlib";            pkg = "nvdlib" },
        @{ name = "vulners";           pkg = "vulners" },
        @{ name = "pymisp";            pkg = "pymisp" },
        @{ name = "pycti";             pkg = "pycti" },
        @{ name = "OTXv2";             pkg = "OTXv2" },
        @{ name = "vt-py";             pkg = "vt-py" },
        @{ name = "yara-python";       pkg = "yara-python" },
        @{ name = "sherlock-project";  pkg = "sherlock-project" },
        @{ name = "maigret";           pkg = "maigret" },
        @{ name = "holehe";            pkg = "holehe" },
        @{ name = "h8mail";            pkg = "h8mail" },
        @{ name = "social-analyzer";   pkg = "social-analyzer" },
        @{ name = "snscrape";          pkg = "snscrape" },
        @{ name = "dnstwist";          pkg = "dnstwist" },
        @{ name = "netlas";            pkg = "netlas" },
        @{ name = "ipinfo";            pkg = "ipinfo" },
        @{ name = "onionsearch";       pkg = "onionsearch" },
        @{ name = "PySocks";           pkg = "PySocks" },
        @{ name = "selenium";          pkg = "selenium" },
        @{ name = "whatstk";           pkg = "whatstk" }
    )

    foreach ($item in $optional) {
        Write-Host "  Installing $($item.pkg)..." -NoNewline
        pip install $item.pkg 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
        } else {
            Write-Host " SKIP" -ForegroundColor Yellow
        }
    }
}

function Install-Go {
    if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
        Write-Host "`n[!] Go not installed - skipping Go CLI tools" -ForegroundColor Yellow
        Write-Host "    Download from: https://go.dev/dl/" -ForegroundColor Yellow
        return
    }

    Write-Host "`n=== Installing Go CLI Tools ===" -ForegroundColor Cyan

    $goTools = @(
        @{ name = "subfinder";    path = "github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest" },
        @{ name = "httpx";        path = "github.com/projectdiscovery/httpx/cmd/httpx@latest" },
        @{ name = "katana";       path = "github.com/projectdiscovery/katana/cmd/katana@latest" },
        @{ name = "dnsx";         path = "github.com/projectdiscovery/dnsx/cmd/dnsx@latest" },
        @{ name = "assetfinder";  path = "github.com/tomnomnom/assetfinder@latest" },
        @{ name = "waybackurls";  path = "github.com/tomnomnom/waybackurls@latest" },
        @{ name = "gau";          path = "github.com/lc/gau/v2/cmd/gau@latest" },
        @{ name = "gitleaks";     path = "github.com/gitleaks/gitleaks/v8@latest" },
        @{ name = "trufflehog";   path = "github.com/trufflesecurity/trufflehog/v3@latest" },
        @{ name = "amass";        path = "github.com/owasp-amass/amass/v4/...@master" }
    )

    foreach ($tool in $goTools) {
        Write-Host "  Installing $($tool.name)..." -NoNewline
        go install -v $tool.path 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
        } else {
            Write-Host " FAIL" -ForegroundColor Red
        }
    }

    # Check GOPATH in PATH
    $gobin = Join-Path (go env GOPATH) "bin"
    if ($env:PATH -notlike "*$gobin*") {
        Write-Host "`n  [!] Add to PATH: $gobin" -ForegroundColor Yellow
        $env:PATH = "$env:PATH;$gobin"
    }
}

function Install-Frontend {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "`n[!] Node.js not installed - skipping frontend" -ForegroundColor Yellow
        return
    }

    Write-Host "`n=== Installing Frontend ===" -ForegroundColor Cyan
    Set-Location "$root\frontend"
    npm install 2>&1 | Select-Object -Last 3
    Set-Location $root
    Write-OK "Frontend dependencies installed"
}

function Setup-Env {
    Write-Host "`n=== Environment Setup ===" -ForegroundColor Cyan
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-OK "Created .env from .env.example"
        Write-WARN "Edit .env and add your API keys!"
    } else {
        Write-OK ".env already exists"
    }
}

# ═══════════════════════════════════════════════════════════════════════
# CHECK / VERIFY
# ═══════════════════════════════════════════════════════════════════════

function Check-All {
    Write-Host "`n" -NoNewline
    Write-Host "======================================================" -ForegroundColor White
    Write-Host "  HYDRA INTEL - Tool Availability Report" -ForegroundColor White
    Write-Host "======================================================" -ForegroundColor White

    Write-Host "`n-- Python Packages --" -ForegroundColor Cyan
    foreach ($mod in @("requests","bs4","fastapi","praw","telethon","pyrogram",
                       "shodan","censys","nmap","nvdlib","vulners","pymisp",
                       "pycti","OTXv2","vt","yara","holehe","dnstwist",
                       "snscrape","netlas","ipinfo")) {
        Test-PyModule $mod | Out-Null
    }

    Write-Host "`n-- CLI Binaries --" -ForegroundColor Cyan
    foreach ($cmd in @("subfinder","httpx","katana","dnsx","assetfinder",
                       "waybackurls","gau","gitleaks","trufflehog","amass",
                       "sherlock","maigret","nmap","dnsrecon","onionsearch")) {
        Test-Cmd $cmd | Out-Null
    }

    Write-Host "`n-- API Keys --" -ForegroundColor Cyan
    foreach ($key in @("GITHUB_TOKEN","SHODAN_API_KEY","CENSYS_API_ID",
                       "ABUSEIPDB_API_KEY","VIRUSTOTAL_API_KEY","OTX_API_KEY",
                       "INTELX_API_KEY","REDDIT_CLIENT_ID","TELEGRAM_API_ID",
                       "HIBP_API_KEY","DEHASHED_API_KEY","SNUSBASE_API_KEY",
                       "LEAKCHECK_API_KEY","LEAKLOOKUP_API_KEY",
                       "SECURITYTRAILS_API_KEY","NETLAS_API_KEY",
                       "IPINFO_API_KEY","SOCIAL_SEARCHER_API_KEY")) {
        Test-EnvVar $key | Out-Null
    }

    Write-Host "`n======================================================" -ForegroundColor White
    Write-Host "  Available: $totalOk  |  Missing: $totalFail  |  Warnings: $totalWarn" -ForegroundColor White
    Write-Host "======================================================`n" -ForegroundColor White
}

# ═══════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════

function Run-Tests {
    Write-Host "`n" -NoNewline
    Write-Host "======================================================" -ForegroundColor White
    Write-Host "  HYDRA INTEL - Integration Tests" -ForegroundColor White
    Write-Host "======================================================`n" -ForegroundColor White

    # Test 1: Registry
    Write-INFO "Test 1: Tool registry..."
    python -c "
from core.tool_registry import ToolRegistry
r = ToolRegistry()
t = r.get_all_tools()
assert len(t) >= 90, f'Expected 90+, got {len(t)}'
print(f'  {len(t)} tools registered')
"
    if ($LASTEXITCODE -eq 0) { Write-OK "Registry OK" } else { Write-FAIL "Registry FAILED" }

    # Test 2: Executors
    Write-INFO "Test 2: Executor registry..."
    python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
e = tm.executor_registry.list_registered()
assert len(e) >= 70, f'Expected 70+, got {len(e)}'
print(f'  {len(e)} executors registered')
"
    if ($LASTEXITCODE -eq 0) { Write-OK "Executors OK" } else { Write-FAIL "Executors FAILED" }

    # Test 3: DNSDumpster (free)
    Write-INFO "Test 3: DNSDumpster (no key needed)..."
    python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
r = tm.executor_registry.get('dnsdumpster')(None, 'example.com', 5)
assert len(r) > 0
print(f'  {len(r)} hosts found')
for x in r[:3]: print(f'    {x[\"title\"]}')
"
    if ($LASTEXITCODE -eq 0) { Write-OK "DNSDumpster OK" } else { Write-WARN "DNSDumpster failed" }

    # Test 4: IPinfo (free)
    Write-INFO "Test 4: IPinfo (no key needed)..."
    python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
r = tm.executor_registry.get('ipinfo')(None, '8.8.8.8', 1)
assert len(r) > 0
print(f'  {r[0][\"title\"]}')
print(f'  {r[0][\"content\"]}')
"
    if ($LASTEXITCODE -eq 0) { Write-OK "IPinfo OK" } else { Write-WARN "IPinfo failed" }

    # Test 5: Collector service
    Write-INFO "Test 5: Collector service..."
    python -c "
from server.services.collector_service import CollectorService
from storage.database import IntelDatabase
db = IntelDatabase()
svc = CollectorService(db)
s = svc.get_all_statuses()
assert len(s) >= 11, f'Expected 11+, got {len(s)}'
print(f'  {len(s)} collectors: {chr(44).join(x[\"source\"] for x in s)}')
"
    if ($LASTEXITCODE -eq 0) { Write-OK "Collector service OK" } else { Write-FAIL "Collector service FAILED" }

    Write-Host "`nTests complete.`n" -ForegroundColor White
}

# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  HYDRA INTEL - Tool Installer" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

switch ($Mode) {
    "check" { Check-All }
    "pip"   { Install-Pip; Check-All }
    "go"    { Install-Go; Check-All }
    "test"  { Run-Tests }
    "all"   {
        Setup-Env
        Install-Pip
        Install-Go
        Install-Frontend
        Check-All

        Write-Host "Installation complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Edit .env and add your API keys"
        Write-Host "  2. Run: powershell -File scripts\install_tools.ps1 -Mode test"
        Write-Host "  3. Start backend:  uvicorn server.app:app --reload --port 8000"
        Write-Host "  4. Start frontend: cd frontend && npm run dev"
        Write-Host ""
    }
}

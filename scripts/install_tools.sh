#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# HYDRA INTEL — Full Tool Installation Script
# Installs all OSINT tools: Python packages, Go binaries, npm tools,
# sets up .env, and verifies everything.
#
# Usage:
#   chmod +x scripts/install_tools.sh
#   ./scripts/install_tools.sh            # Install everything
#   ./scripts/install_tools.sh --check    # Only verify what's installed
#   ./scripts/install_tools.sh --pip      # Only Python packages
#   ./scripts/install_tools.sh --go       # Only Go binaries
#   ./scripts/install_tools.sh --test     # Run quick integration tests
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS="${GREEN}[OK]${NC}"
FAIL="${RED}[MISSING]${NC}"
WARN="${YELLOW}[WARN]${NC}"
INFO="${CYAN}[*]${NC}"

# ── Helpers ───────────────────────────────────────────────────────────
log()  { echo -e "${INFO} $*"; }
ok()   { echo -e "  ${PASS} $*"; }
fail() { echo -e "  ${FAIL} $*"; }
warn() { echo -e "  ${WARN} $*"; }

HYDRA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOTAL_OK=0
TOTAL_FAIL=0
TOTAL_WARN=0

check_cmd() {
    if command -v "$1" &>/dev/null; then
        ok "$1 $(command -v "$1")"
        ((TOTAL_OK++)) || true
        return 0
    else
        fail "$1"
        ((TOTAL_FAIL++)) || true
        return 1
    fi
}

check_py() {
    if python -c "import $1" 2>/dev/null; then
        ok "python: $1"
        ((TOTAL_OK++)) || true
        return 0
    else
        fail "python: $1"
        ((TOTAL_FAIL++)) || true
        return 1
    fi
}

check_env() {
    if [[ -n "${!1:-}" ]]; then
        ok "env: $1 (set)"
        ((TOTAL_OK++)) || true
        return 0
    else
        warn "env: $1 (not set)"
        ((TOTAL_WARN++)) || true
        return 1
    fi
}

# ── Prerequisites ─────────────────────────────────────────────────────
install_prerequisites() {
    log "Checking prerequisites..."

    if ! command -v python &>/dev/null && ! command -v python3 &>/dev/null; then
        echo -e "${RED}Python 3.11+ is required. Install from python.org${NC}"
        exit 1
    fi
    ok "Python $(python --version 2>&1 | cut -d' ' -f2)"

    if ! command -v pip &>/dev/null && ! command -v pip3 &>/dev/null; then
        echo -e "${RED}pip is required. Run: python -m ensurepip${NC}"
        exit 1
    fi
    ok "pip available"

    if command -v go &>/dev/null; then
        ok "Go $(go version | cut -d' ' -f3)"
    else
        warn "Go not installed — Go CLI tools will be skipped"
        warn "Install from: https://go.dev/dl/"
    fi

    if command -v node &>/dev/null; then
        ok "Node $(node --version)"
    else
        warn "Node.js not installed — frontend will be skipped"
    fi

    echo ""
}

# ── Python Packages ───────────────────────────────────────────────────
install_pip() {
    log "Installing Python packages..."

    # Core requirements
    pip install -r "$HYDRA_ROOT/requirements.txt" 2>&1 | tail -5

    # Additional OSINT packages not in requirements.txt (optional)
    log "Installing optional OSINT packages..."
    local optional_pkgs=(
        "blackbird-osint"
        "whatsmyname"
        "social-analyzer"
        "snscrape"
        "pyrogram"
        "tgcrypto"
        "netlas"
        "ipinfo"
    )

    for pkg in "${optional_pkgs[@]}"; do
        if pip install "$pkg" 2>/dev/null; then
            ok "pip: $pkg"
        else
            warn "pip: $pkg (install failed — may not be critical)"
        fi
    done

    echo ""
}

# ── Go Binaries ───────────────────────────────────────────────────────
install_go() {
    if ! command -v go &>/dev/null; then
        warn "Skipping Go tools — Go is not installed"
        return
    fi

    log "Installing Go CLI tools..."

    local go_tools=(
        "github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest"
        "github.com/projectdiscovery/httpx/cmd/httpx@latest"
        "github.com/projectdiscovery/katana/cmd/katana@latest"
        "github.com/projectdiscovery/dnsx/cmd/dnsx@latest"
        "github.com/tomnomnom/assetfinder@latest"
        "github.com/tomnomnom/waybackurls@latest"
        "github.com/lc/gau/v2/cmd/gau@latest"
        "github.com/gitleaks/gitleaks/v8@latest"
        "github.com/trufflesecurity/trufflehog/v3@latest"
        "github.com/owasp-amass/amass/v4/...@master"
    )

    for tool_path in "${go_tools[@]}"; do
        local name
        name=$(echo "$tool_path" | sed 's|.*/||' | sed 's|@.*||' | sed 's|\.\.\.||')
        log "  Installing $name..."
        if go install -v "$tool_path" 2>/dev/null; then
            ok "$name"
        else
            warn "$name (install failed)"
        fi
    done

    # Ensure GOPATH/bin is in PATH
    GOBIN="${GOPATH:-$HOME/go}/bin"
    if [[ ":$PATH:" != *":$GOBIN:"* ]]; then
        warn "Add to your PATH: export PATH=\$PATH:$GOBIN"
        export PATH="$PATH:$GOBIN"
    fi

    echo ""
}

# ── Frontend ──────────────────────────────────────────────────────────
install_frontend() {
    if ! command -v node &>/dev/null; then
        warn "Skipping frontend — Node.js not installed"
        return
    fi

    log "Installing frontend dependencies..."
    cd "$HYDRA_ROOT/frontend"

    if command -v npm &>/dev/null; then
        npm install 2>&1 | tail -3
        ok "Frontend dependencies installed"
    fi

    cd "$HYDRA_ROOT"
    echo ""
}

# ── Environment Setup ─────────────────────────────────────────────────
setup_env() {
    log "Setting up environment..."

    if [[ ! -f "$HYDRA_ROOT/.env" ]]; then
        cp "$HYDRA_ROOT/.env.example" "$HYDRA_ROOT/.env"
        ok "Created .env from .env.example"
        warn "Edit .env and add your API keys!"
    else
        ok ".env already exists"
    fi

    echo ""
}

# ── Verification ──────────────────────────────────────────────────────
check_all() {
    # Load .env if present
    if [[ -f "$HYDRA_ROOT/.env" ]]; then
        set -a
        source "$HYDRA_ROOT/.env" 2>/dev/null || true
        set +a
    fi

    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  HYDRA INTEL — Tool Availability Report${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
    echo ""

    # ── Python packages ──
    echo -e "${CYAN}── Python Packages ──${NC}"
    check_py requests
    check_py bs4
    check_py fastapi
    check_py praw
    check_py telethon
    check_py pyrogram
    check_py shodan
    check_py censys
    check_py nmap
    check_py nvdlib
    check_py vulners
    check_py pymisp
    check_py pycti
    check_py OTXv2
    check_py vt
    check_py yara
    check_py holehe
    check_py dnstwist
    check_py snscrape
    check_py netlas
    check_py ipinfo
    echo ""

    # ── CLI tools ──
    echo -e "${CYAN}── CLI Binaries ──${NC}"
    check_cmd subfinder
    check_cmd httpx
    check_cmd katana
    check_cmd dnsx
    check_cmd assetfinder
    check_cmd waybackurls
    check_cmd gau
    check_cmd gitleaks
    check_cmd trufflehog
    check_cmd amass
    check_cmd sherlock
    check_cmd maigret
    check_cmd nmap
    check_cmd dnsrecon
    check_cmd searchsploit
    check_cmd onionsearch
    echo ""

    # ── API keys ──
    echo -e "${CYAN}── API Keys ──${NC}"
    check_env GITHUB_TOKEN
    check_env SHODAN_API_KEY
    check_env CENSYS_API_ID
    check_env ABUSEIPDB_API_KEY
    check_env VIRUSTOTAL_API_KEY
    check_env OTX_API_KEY
    check_env INTELX_API_KEY
    check_env REDDIT_CLIENT_ID
    check_env TELEGRAM_API_ID
    check_env HIBP_API_KEY
    check_env DEHASHED_API_KEY
    check_env SNUSBASE_API_KEY
    check_env LEAKCHECK_API_KEY
    check_env LEAKLOOKUP_API_KEY
    check_env SECURITYTRAILS_API_KEY
    check_env NETLAS_API_KEY
    check_env IPINFO_API_KEY
    check_env SOCIAL_SEARCHER_API_KEY
    echo ""

    # ── Summary ──
    echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
    echo -e "  ${GREEN}Available: $TOTAL_OK${NC}  |  ${RED}Missing: $TOTAL_FAIL${NC}  |  ${YELLOW}Warnings: $TOTAL_WARN${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
    echo ""
}

# ── Integration Tests ─────────────────────────────────────────────────
run_tests() {
    # Load .env if present
    if [[ -f "$HYDRA_ROOT/.env" ]]; then
        set -a
        source "$HYDRA_ROOT/.env" 2>/dev/null || true
        set +a
    fi

    cd "$HYDRA_ROOT"

    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  HYDRA INTEL — Integration Tests${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
    echo ""

    # Test 1: Registry loads
    log "Test 1: Tool registry initialization..."
    python -c "
from core.tool_registry import ToolRegistry
r = ToolRegistry()
tools = r.get_all_tools()
assert len(tools) >= 90, f'Expected 90+ tools, got {len(tools)}'
print(f'  {len(tools)} tools registered across 14 categories')
" && ok "Tool registry OK" || fail "Tool registry FAILED"

    # Test 2: Executor registry
    log "Test 2: Executor registration..."
    python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
executors = tm.executor_registry.list_registered()
assert len(executors) >= 70, f'Expected 70+ executors, got {len(executors)}'
print(f'  {len(executors)} executors registered')
" && ok "Executor registry OK" || fail "Executor registry FAILED"

    # Test 3: DNSDumpster (free, no auth)
    log "Test 3: DNSDumpster (no API key needed)..."
    python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
executor = tm.executor_registry.get('dnsdumpster')
results = executor(None, 'example.com', 5)
assert len(results) > 0, 'No results from dnsdumpster'
print(f'  {len(results)} hosts found for example.com')
for r in results[:3]:
    print(f'    {r[\"title\"]}')
" && ok "DNSDumpster OK" || warn "DNSDumpster failed (network?)"

    # Test 4: IPinfo (works without key)
    log "Test 4: IPinfo lookup (no key needed for basic)..."
    python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
executor = tm.executor_registry.get('ipinfo')
results = executor(None, '8.8.8.8', 1)
assert len(results) > 0, 'No results from ipinfo'
print(f'  {results[0][\"title\"]}')
print(f'  {results[0][\"content\"]}')
" && ok "IPinfo OK" || warn "IPinfo failed (network?)"

    # Test 5: EmailRep (free, no key)
    log "Test 5: EmailRep lookup (no key needed)..."
    python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
executor = tm.executor_registry.get('emailrep')
results = executor(None, 'bill@microsoft.com', 1)
assert len(results) > 0, 'No results from emailrep'
print(f'  {results[0][\"content\"]}')
" && ok "EmailRep OK" || warn "EmailRep failed (network?)"

    # Test 6: CLI tools (subfinder)
    if command -v subfinder &>/dev/null; then
        log "Test 6: Subfinder CLI..."
        python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
executor = tm.executor_registry.get('subfinder')
results = executor(None, 'example.com', 5)
print(f'  {len(results)} subdomains found')
" && ok "Subfinder OK" || warn "Subfinder failed"
    else
        warn "Test 6: Subfinder skipped (not installed)"
    fi

    # Test 7: Sherlock
    if command -v sherlock &>/dev/null; then
        log "Test 7: Sherlock username search..."
        python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
executor = tm.executor_registry.get('sherlock')
results = executor(None, 'john', 10)
print(f'  {len(results)} profiles found')
" && ok "Sherlock OK" || warn "Sherlock failed"
    else
        warn "Test 7: Sherlock skipped (not installed)"
    fi

    # Test 8: Collector service
    log "Test 8: Collector service initialization..."
    python -c "
from server.services.collector_service import CollectorService
from storage.database import IntelDatabase
db = IntelDatabase()
svc = CollectorService(db)
statuses = svc.get_all_statuses()
assert len(statuses) >= 11, f'Expected 11+ collectors, got {len(statuses)}'
sources = [s['source'] for s in statuses]
print(f'  {len(statuses)} collectors registered: {\", \".join(sources)}')
" && ok "Collector service OK" || fail "Collector service FAILED"

    # Test 9: Shodan (if key set)
    if [[ -n "${SHODAN_API_KEY:-}" ]]; then
        log "Test 9: Shodan API..."
        python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
executor = tm.executor_registry.get('shodan-cli')
results = executor(None, 'apache country:US', 3)
print(f'  {len(results)} results from Shodan')
" && ok "Shodan OK" || warn "Shodan failed"
    else
        warn "Test 9: Shodan skipped (SHODAN_API_KEY not set)"
    fi

    # Test 10: HIBP (if key set)
    if [[ -n "${HIBP_API_KEY:-}" ]]; then
        log "Test 10: HaveIBeenPwned API..."
        python -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
executor = tm.executor_registry.get('haveibeenpwned')
results = executor(None, 'test@example.com', 5)
print(f'  {len(results)} breaches found')
" && ok "HIBP OK" || warn "HIBP failed"
    else
        warn "Test 10: HIBP skipped (HIBP_API_KEY not set)"
    fi

    echo ""
    echo -e "${BOLD}Tests complete.${NC}"
    echo ""
}

# ── Windows PowerShell wrapper ────────────────────────────────────────
generate_ps1() {
    cat > "$HYDRA_ROOT/scripts/install_tools.ps1" << 'POWERSHELL'
# HYDRA INTEL - Windows Installation Script
# Run: powershell -ExecutionPolicy Bypass -File scripts\install_tools.ps1

Write-Host "`n=== HYDRA INTEL - Tool Installer (Windows) ===" -ForegroundColor Cyan

# Python packages
Write-Host "`n[*] Installing Python packages..." -ForegroundColor Cyan
pip install -r requirements.txt
$optional = @("blackbird-osint","whatsmyname","social-analyzer","snscrape","pyrogram","tgcrypto","netlas","ipinfo")
foreach ($pkg in $optional) {
    Write-Host "  Installing $pkg..." -NoNewline
    pip install $pkg 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green }
    else { Write-Host " SKIP" -ForegroundColor Yellow }
}

# Go tools
if (Get-Command go -ErrorAction SilentlyContinue) {
    Write-Host "`n[*] Installing Go CLI tools..." -ForegroundColor Cyan
    $gotools = @(
        "github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest",
        "github.com/projectdiscovery/httpx/cmd/httpx@latest",
        "github.com/projectdiscovery/katana/cmd/katana@latest",
        "github.com/projectdiscovery/dnsx/cmd/dnsx@latest",
        "github.com/tomnomnom/assetfinder@latest",
        "github.com/tomnomnom/waybackurls@latest",
        "github.com/lc/gau/v2/cmd/gau@latest",
        "github.com/gitleaks/gitleaks/v8@latest",
        "github.com/trufflesecurity/trufflehog/v3@latest"
    )
    foreach ($tool in $gotools) {
        $name = ($tool -split '/')[-1] -replace '@.*',''
        Write-Host "  Installing $name..." -NoNewline
        go install -v $tool 2>$null
        if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green }
        else { Write-Host " FAIL" -ForegroundColor Red }
    }
} else {
    Write-Host "`n[!] Go not found - skipping Go tools" -ForegroundColor Yellow
    Write-Host "    Install from: https://go.dev/dl/" -ForegroundColor Yellow
}

# .env setup
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "`n[OK] Created .env from .env.example" -ForegroundColor Green
    Write-Host "[!] Edit .env and add your API keys!" -ForegroundColor Yellow
}

# Frontend
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "`n[*] Installing frontend..." -ForegroundColor Cyan
    Set-Location frontend
    npm install
    Set-Location ..
}

# Verify
Write-Host "`n=== Verification ===" -ForegroundColor Cyan
python -c "
from core.tool_registry import ToolRegistry
from core.tool_manager import ToolManager
r = ToolRegistry()
tm = ToolManager()
tm._register_builtin_executors()
print(f'Tools registered: {len(r.get_all_tools())}')
print(f'Executors registered: {len(tm.executor_registry.list_registered())}')
tm.initialize()
status = tm.get_status()
print(f'Available: {status[\"health_report\"][\"available\"]}')
print(f'Auth required: {status[\"health_report\"][\"auth_required\"]}')
print(f'Unavailable: {status[\"health_report\"][\"unavailable\"]}')
"

Write-Host "`n=== Done! ===" -ForegroundColor Green
Write-Host "Start backend:  uvicorn server.app:app --reload --port 8000"
Write-Host "Start frontend: cd frontend && npm run dev"
POWERSHELL

    ok "Generated scripts/install_tools.ps1 for Windows"
}

# ── Main ──────────────────────────────────────────────────────────────
main() {
    cd "$HYDRA_ROOT"

    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  HYDRA INTEL — Tool Installer${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
    echo ""

    case "${1:-all}" in
        --check)
            check_all
            ;;
        --pip)
            install_prerequisites
            install_pip
            check_all
            ;;
        --go)
            install_prerequisites
            install_go
            check_all
            ;;
        --test)
            run_tests
            ;;
        --ps1)
            generate_ps1
            ;;
        all|--all)
            install_prerequisites
            setup_env
            install_pip
            install_go
            install_frontend
            generate_ps1
            check_all

            echo ""
            echo -e "${BOLD}Installation complete!${NC}"
            echo ""
            echo -e "  ${CYAN}Next steps:${NC}"
            echo -e "  1. Edit ${BOLD}.env${NC} and add your API keys"
            echo -e "  2. Run ${BOLD}./scripts/install_tools.sh --test${NC} to verify"
            echo -e "  3. Start backend:  ${BOLD}uvicorn server.app:app --reload --port 8000${NC}"
            echo -e "  4. Start frontend: ${BOLD}cd frontend && npm run dev${NC}"
            echo ""
            ;;
        *)
            echo "Usage: $0 [--all|--check|--pip|--go|--test|--ps1]"
            echo ""
            echo "  --all    Install everything (default)"
            echo "  --check  Only verify tool availability"
            echo "  --pip    Only install Python packages"
            echo "  --go     Only install Go binaries"
            echo "  --test   Run integration tests"
            echo "  --ps1    Generate Windows PowerShell installer"
            ;;
    esac
}

main "$@"

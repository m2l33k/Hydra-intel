#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HYDRA INTEL — Ubuntu/Debian Full Install Script
#
# Usage:
#   chmod +x scripts/install_ubuntu.sh
#   sudo bash scripts/install_ubuntu.sh
#
# Installs: system tools, Go CLI tools, Python OSINT tools,
#           Node.js, frontend deps, and the HYDRA platform
# ═══════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0

ok()   { echo -e "  ${GREEN}[+]${NC} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}[-]${NC} $1"; ((FAIL++)); }
info() { echo -e "  ${CYAN}[*]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[!]${NC} $1"; }

# ── Check root ────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Run with sudo: sudo bash $0${NC}"
    exit 1
fi

REAL_USER=${SUDO_USER:-$USER}
REAL_HOME=$(eval echo ~$REAL_USER)
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  HYDRA INTEL — Ubuntu/Debian Full Installer${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# 1. SYSTEM PACKAGES
# ══════════════════════════════════════════════════════════════
echo -e "${CYAN}[1/7] Installing system packages...${NC}"

apt-get update -qq

# Network & recon tools
apt-get install -y --no-install-recommends \
    nmap \
    whois \
    dnsutils \
    bind9-host \
    traceroute \
    netcat-openbsd \
    curl \
    wget \
    jq \
    unzip \
    git \
    && ok "Network tools (nmap, whois, dig, traceroute, curl, wget, jq)" \
    || fail "Network tools"

# Tor & privacy
apt-get install -y --no-install-recommends \
    tor \
    torsocks \
    proxychains4 \
    && ok "Tor + torsocks + proxychains4" \
    || fail "Tor stack"

# Browser automation
apt-get install -y --no-install-recommends \
    chromium-browser 2>/dev/null || \
    apt-get install -y --no-install-recommends chromium 2>/dev/null || \
    warn "Chromium not available in repos"
apt-get install -y --no-install-recommends chromium-chromedriver 2>/dev/null || \
    apt-get install -y --no-install-recommends chromium-driver 2>/dev/null || true
ok "Chromium browser"

# Metadata
apt-get install -y --no-install-recommends \
    libimage-exiftool-perl \
    && ok "ExifTool" \
    || fail "ExifTool"

# Build tools (needed for some pip packages)
apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt1-dev \
    libmagic1 \
    ca-certificates \
    && ok "Build tools & libraries" \
    || fail "Build tools"

echo ""

# ══════════════════════════════════════════════════════════════
# 2. PYTHON 3.11+
# ══════════════════════════════════════════════════════════════
echo -e "${CYAN}[2/7] Setting up Python...${NC}"

if command -v python3 &>/dev/null; then
    PY_VER=$(python3 --version | awk '{print $2}')
    ok "Python $PY_VER already installed"
else
    apt-get install -y python3 python3-pip python3-venv
    ok "Python3 installed"
fi

apt-get install -y python3-pip python3-venv python3-dev 2>/dev/null || true

echo ""

# ══════════════════════════════════════════════════════════════
# 3. NODE.JS 22
# ══════════════════════════════════════════════════════════════
echo -e "${CYAN}[3/7] Setting up Node.js...${NC}"

if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    ok "Node.js $NODE_VER already installed"
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
    ok "Node.js 22 installed"
fi

echo ""

# ══════════════════════════════════════════════════════════════
# 4. GO 1.24+ & CLI TOOLS
# ══════════════════════════════════════════════════════════════
echo -e "${CYAN}[4/7] Installing Go & OSINT CLI tools...${NC}"

# Install Go if not present or too old
GO_NEEDED=false
if command -v go &>/dev/null; then
    GO_VER=$(go version | grep -oP '\d+\.\d+')
    if (( $(echo "$GO_VER < 1.24" | bc -l) )); then
        GO_NEEDED=true
        warn "Go $GO_VER too old, need 1.24+"
    else
        ok "Go $GO_VER already installed"
    fi
else
    GO_NEEDED=true
fi

if [ "$GO_NEEDED" = true ]; then
    info "Installing Go 1.24..."
    wget -q https://go.dev/dl/go1.24.1.linux-amd64.tar.gz -O /tmp/go.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tar.gz
    rm /tmp/go.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile.d/go.sh
    ok "Go 1.24 installed"
fi

# Set GOPATH for the real user
export GOPATH="$REAL_HOME/go"
export PATH="$PATH:/usr/local/go/bin:$GOPATH/bin"
mkdir -p "$GOPATH/bin"

# Install Go OSINT tools
GO_TOOLS=(
    "subfinder|github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest"
    "httpx|github.com/projectdiscovery/httpx/cmd/httpx@v1.6.9"
    "katana|github.com/projectdiscovery/katana/cmd/katana@v1.1.0"
    "dnsx|github.com/projectdiscovery/dnsx/cmd/dnsx@v1.2.1"
    "nuclei|github.com/projectdiscovery/nuclei/v3/cmd/nuclei@v3.3.7"
    "gitleaks|github.com/gitleaks/gitleaks/v8@latest"
    "trufflehog|github.com/trufflesecurity/trufflehog/v3@latest"
    "amass|github.com/owasp-amass/amass/v4/...@master"
    "assetfinder|github.com/tomnomnom/assetfinder@latest"
    "waybackurls|github.com/tomnomnom/waybackurls@latest"
    "gau|github.com/lc/gau/v2/cmd/gau@latest"
)

for entry in "${GO_TOOLS[@]}"; do
    IFS='|' read -r name pkg <<< "$entry"
    info "Installing $name..."
    sudo -u "$REAL_USER" GOPATH="$GOPATH" PATH="$PATH" go install -v "$pkg" 2>/dev/null \
        && ok "$name" \
        || fail "$name (may need newer Go)"
done

# Copy Go binaries to /usr/local/bin so they're in PATH for everyone
cp "$GOPATH/bin/"* /usr/local/bin/ 2>/dev/null || true

echo ""

# ══════════════════════════════════════════════════════════════
# 5. PYTHON OSINT TOOLS
# ══════════════════════════════════════════════════════════════
echo -e "${CYAN}[5/7] Installing Python OSINT packages...${NC}"

# Core requirements
info "Installing core requirements..."
pip3 install --break-system-packages -r "$PROJECT_DIR/requirements.txt" 2>/dev/null \
    || pip3 install -r "$PROJECT_DIR/requirements.txt" 2>/dev/null \
    || warn "Some core requirements failed"

# OSINT tools (each individually so failures don't block)
PIP_TOOLS=(
    "sherlock-project"
    "maigret"
    "social-analyzer"
    "snscrape"
    "holehe"
    "h8mail"
    "dnstwist"
    "dnsrecon"
    "python-nmap"
    "telethon"
    "pyrogram"
    "tgcrypto"
    "praw"
    "PySocks"
    "onionsearch"
    "nvdlib"
    "selenium"
    "webdriver-manager"
    "yara-python"
    "ipinfo"
    "netlas"
    "shodan"
    "theHarvester"
    "python-dotenv"
    "aiofiles"
    "python-multipart"
)

for pkg in "${PIP_TOOLS[@]}"; do
    pip3 install --break-system-packages --no-cache-dir "$pkg" 2>/dev/null \
        && ok "pip: $pkg" \
        || fail "pip: $pkg"
done

echo ""

# ══════════════════════════════════════════════════════════════
# 6. FRONTEND SETUP
# ══════════════════════════════════════════════════════════════
echo -e "${CYAN}[6/7] Setting up frontend...${NC}"

if [ -d "$PROJECT_DIR/frontend" ]; then
    cd "$PROJECT_DIR/frontend"
    sudo -u "$REAL_USER" npm install --prefer-offline --no-audit 2>/dev/null \
        || sudo -u "$REAL_USER" npm install 2>/dev/null
    ok "Frontend dependencies installed"
    cd "$PROJECT_DIR"
else
    warn "frontend/ directory not found"
fi

echo ""

# ══════════════════════════════════════════════════════════════
# 7. PLATFORM SETUP
# ══════════════════════════════════════════════════════════════
echo -e "${CYAN}[7/7] Platform setup...${NC}"

cd "$PROJECT_DIR"

# Create dirs
mkdir -p logs data yara-rules
chown -R "$REAL_USER:$REAL_USER" logs data yara-rules 2>/dev/null || true

# Create .env
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    chown "$REAL_USER:$REAL_USER" .env
    ok "Created .env from .env.example"
    warn "Edit .env and add your API keys!"
else
    ok ".env exists"
fi

# Configure Tor
if [ -f /etc/tor/torrc ]; then
    grep -q "SocksPort 9050" /etc/tor/torrc || echo "SocksPort 9050" >> /etc/tor/torrc
    ok "Tor configured on port 9050"
fi

# Make scripts executable
chmod +x scripts/*.sh scripts/*.py 2>/dev/null || true

echo ""

# ══════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Installed: $PASS${NC}  |  ${RED}Failed: $FAIL${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}To start HYDRA INTEL:${NC}"
echo ""
echo "  # Terminal 1 — Backend"
echo "  cd $PROJECT_DIR"
echo "  python3 run_server.py"
echo ""
echo "  # Terminal 2 — Frontend"
echo "  cd $PROJECT_DIR/frontend"
echo "  npm run dev"
echo ""
echo "  # Then open:"
echo "  #   Frontend: http://localhost:3000"
echo "  #   Backend:  http://localhost:8000"
echo "  #   API Docs: http://localhost:8000/docs"
echo ""
echo -e "${CYAN}To use OSINT tools directly:${NC}"
echo "  subfinder -d example.com"
echo "  nmap -sV example.com"
echo "  sherlock username"
echo "  nuclei -u https://example.com"
echo ""
echo -e "${CYAN}To verify all tools:${NC}"
echo "  python3 scripts/verify_tools.py"
echo ""

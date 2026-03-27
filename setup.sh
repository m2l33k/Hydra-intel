#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HYDRA INTEL — Tool Verification Script
# Run inside Docker or on bare metal
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
SKIP=0

check_tool() {
    local name="$1"
    local cmd="$2"
    local install_hint="$3"

    if command -v "$cmd" &>/dev/null; then
        printf "  ${GREEN}[+]${NC} %-25s ${GREEN}available${NC}\n" "$name"
        ((PASS++))
    else
        printf "  ${RED}[-]${NC} %-25s ${RED}missing${NC}  → %s\n" "$name" "$install_hint"
        ((FAIL++))
    fi
}

check_python_pkg() {
    local name="$1"
    local module="$2"
    local install_hint="$3"

    if python3 -c "import $module" 2>/dev/null; then
        printf "  ${GREEN}[+]${NC} %-25s ${GREEN}available${NC}\n" "$name"
        ((PASS++))
    else
        printf "  ${YELLOW}[~]${NC} %-25s ${YELLOW}not installed${NC} → %s\n" "$name" "$install_hint"
        ((SKIP++))
    fi
}

check_env() {
    local name="$1"
    local var="$2"
    if [ -n "${!var}" ]; then
        printf "  ${GREEN}[+]${NC} %-25s ${GREEN}set${NC}\n" "$name"
    else
        printf "  ${YELLOW}[~]${NC} %-25s ${YELLOW}not set${NC}\n" "$name"
    fi
}

echo ""
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  HYDRA INTEL — Tool Setup & Verification${NC}"
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo ""

# ── System Dependencies ──────────────────────────────
echo -e "${CYAN}[1/8] System Dependencies${NC}"
check_tool "Python 3"          "python3"         "apt install python3"
check_tool "pip"               "pip3"            "apt install python3-pip"
check_tool "Node.js"           "node"            "apt install nodejs"
check_tool "npm"               "npm"             "apt install npm"
check_tool "Git"               "git"             "apt install git"
check_tool "curl"              "curl"            "apt install curl"
check_tool "jq"                "jq"              "apt install jq"
echo ""

# ── Network / Infra Tools ────────────────────────────
echo -e "${CYAN}[2/8] Network & Infrastructure Tools${NC}"
check_tool "nmap"              "nmap"            "apt install nmap"
check_tool "tor"               "tor"             "apt install tor"
check_tool "torsocks"          "torsocks"        "apt install torsocks"
check_tool "whois"             "whois"           "apt install whois"
check_tool "dig (dnsutils)"    "dig"             "apt install dnsutils"
check_tool "host"              "host"            "apt install bind9-host"
check_tool "traceroute"        "traceroute"      "apt install traceroute"
echo ""

# ── Go Binaries ──────────────────────────────────────
echo -e "${CYAN}[3/8] Go-based OSINT Tools${NC}"
check_tool "subfinder"         "subfinder"       "go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest"
check_tool "httpx"             "httpx"           "go install github.com/projectdiscovery/httpx/cmd/httpx@latest"
check_tool "katana"            "katana"          "go install github.com/projectdiscovery/katana/cmd/katana@latest"
check_tool "dnsx"              "dnsx"            "go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest"
check_tool "nuclei"            "nuclei"          "go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest"
check_tool "gitleaks"          "gitleaks"        "go install github.com/gitleaks/gitleaks/v8@latest"
check_tool "trufflehog"        "trufflehog"      "go install github.com/trufflesecurity/trufflehog/v3@latest"
check_tool "amass"             "amass"           "go install github.com/owasp-amass/amass/v4/...@master"
check_tool "assetfinder"       "assetfinder"     "go install github.com/tomnomnom/assetfinder@latest"
check_tool "waybackurls"       "waybackurls"     "go install github.com/tomnomnom/waybackurls@latest"
check_tool "gau"               "gau"             "go install github.com/lc/gau/v2/cmd/gau@latest"
echo ""

# ── Python CLI Tools ─────────────────────────────────
echo -e "${CYAN}[4/8] Python CLI Tools${NC}"
check_tool "sherlock"          "sherlock"        "pip install sherlock-project"
check_tool "maigret"           "maigret"         "pip install maigret"
check_tool "holehe"            "holehe"          "pip install holehe"
check_tool "h8mail"            "h8mail"          "pip install h8mail"
check_tool "theHarvester"      "theHarvester"    "pip install theHarvester"
check_tool "dnstwist"          "dnstwist"        "pip install dnstwist"
check_tool "onionsearch"       "onionsearch"     "pip install onionsearch"
echo ""

# ── Python Libraries ─────────────────────────────────
echo -e "${CYAN}[5/8] Python Libraries — Core${NC}"
check_python_pkg "requests"        "requests"        "pip install requests"
check_python_pkg "beautifulsoup4"  "bs4"             "pip install beautifulsoup4"
check_python_pkg "lxml"            "lxml"            "pip install lxml"
check_python_pkg "fastapi"         "fastapi"         "pip install fastapi"
check_python_pkg "uvicorn"         "uvicorn"         "pip install uvicorn"
check_python_pkg "pydantic"        "pydantic"        "pip install pydantic"
check_python_pkg "httpx-lib"       "httpx"           "pip install httpx"
check_python_pkg "python-dotenv"   "dotenv"          "pip install python-dotenv"
echo ""

echo -e "${CYAN}[6/8] Python Libraries — OSINT${NC}"
check_python_pkg "praw"            "praw"            "pip install praw"
check_python_pkg "telethon"        "telethon"        "pip install telethon"
check_python_pkg "pyrogram"        "pyrogram"        "pip install pyrogram"
check_python_pkg "tgcrypto"        "tgcrypto"        "pip install tgcrypto"
check_python_pkg "shodan"          "shodan"          "pip install shodan"
check_python_pkg "censys"          "censys"          "pip install censys"
check_python_pkg "python-nmap"     "nmap"            "pip install python-nmap"
check_python_pkg "netlas"          "netlas"           "pip install netlas"
check_python_pkg "ipinfo"          "ipinfo"           "pip install ipinfo"
check_python_pkg "nvdlib"          "nvdlib"          "pip install nvdlib"
check_python_pkg "vulners"         "vulners"         "pip install vulners"
check_python_pkg "pymisp"          "pymisp"          "pip install pymisp"
check_python_pkg "pycti"           "pycti"           "pip install pycti"
check_python_pkg "OTXv2"           "OTXv2"           "pip install OTXv2"
check_python_pkg "vt-py"           "vt"              "pip install vt-py"
check_python_pkg "yara-python"     "yara"            "pip install yara-python"
check_python_pkg "social-analyzer" "social_analyzer"  "pip install social-analyzer"
check_python_pkg "snscrape"        "snscrape"        "pip install snscrape"
check_python_pkg "dnstwist"        "dnstwist"        "pip install dnstwist"
check_python_pkg "PySocks"         "socks"           "pip install PySocks"
check_python_pkg "onionsearch"     "onionsearch"     "pip install onionsearch"
check_python_pkg "selenium"        "selenium"        "pip install selenium"
check_python_pkg "whatstk"         "whatstk"         "pip install whatstk"
echo ""

# ── HYDRA Platform ───────────────────────────────────
echo -e "${CYAN}[7/8] HYDRA Platform Internals${NC}"
python3 -c "
from core.tool_registry import ToolRegistry
r = ToolRegistry()
print(f'  \033[92m[+]\033[0m Tool registry:     {len(r.get_all_tools())} tools across 14 categories')
" 2>/dev/null || printf "  ${RED}[-]${NC} Tool registry failed\n"

python3 -c "
from core.tool_manager import ToolManager
tm = ToolManager()
tm._register_builtin_executors()
print(f'  \033[92m[+]\033[0m Executor registry: {len(tm.executor_registry.list_registered())} executors')
" 2>/dev/null || printf "  ${RED}[-]${NC} Executor registry failed\n"

python3 -c "
from core.tool_registry import TargetType
targets = [t.value for t in TargetType]
print(f'  \033[92m[+]\033[0m Target types:      {len(targets)} ({chr(44).join(targets[:5])}...)')
" 2>/dev/null || printf "  ${RED}[-]${NC} Target types failed\n"
echo ""

# ── Environment Variables ────────────────────────────
echo -e "${CYAN}[8/8] API Keys / Environment${NC}"
check_env "GITHUB_TOKEN"           "GITHUB_TOKEN"
check_env "REDDIT_CLIENT_ID"       "REDDIT_CLIENT_ID"
check_env "REDDIT_CLIENT_SECRET"   "REDDIT_CLIENT_SECRET"
check_env "SHODAN_API_KEY"         "SHODAN_API_KEY"
check_env "CENSYS_API_ID"         "CENSYS_API_ID"
check_env "VIRUSTOTAL_API_KEY"     "VIRUSTOTAL_API_KEY"
check_env "OTX_API_KEY"           "OTX_API_KEY"
check_env "ABUSEIPDB_API_KEY"     "ABUSEIPDB_API_KEY"
check_env "VULNERS_API_KEY"       "VULNERS_API_KEY"
check_env "INTELX_API_KEY"        "INTELX_API_KEY"
check_env "NVD_API_KEY"           "NVD_API_KEY"
check_env "TELEGRAM_API_ID"       "TELEGRAM_API_ID"
check_env "TELEGRAM_API_HASH"     "TELEGRAM_API_HASH"
check_env "TELEGRAM_BOT_TOKEN"    "TELEGRAM_BOT_TOKEN"
check_env "NETLAS_API_KEY"        "NETLAS_API_KEY"
check_env "SECURITYTRAILS_API_KEY" "SECURITYTRAILS_API_KEY"
check_env "IPINFO_API_KEY"        "IPINFO_API_KEY"
check_env "SOCIAL_SEARCHER_API_KEY" "SOCIAL_SEARCHER_API_KEY"
check_env "HIBP_API_KEY"          "HIBP_API_KEY"
check_env "DEHASHED_API_KEY"      "DEHASHED_API_KEY"
check_env "SNUSBASE_API_KEY"      "SNUSBASE_API_KEY"
check_env "LEAKCHECK_API_KEY"     "LEAKCHECK_API_KEY"
check_env "LEAKLOOKUP_API_KEY"    "LEAKLOOKUP_API_KEY"
check_env "MISP_URL"              "MISP_URL"
check_env "MISP_KEY"              "MISP_KEY"
check_env "OPENCTI_URL"           "OPENCTI_URL"
check_env "OPENCTI_TOKEN"         "OPENCTI_TOKEN"
echo ""

# ── Summary ──────────────────────────────────────────
TOTAL=$((PASS + FAIL + SKIP))
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Available: $PASS${NC}  |  ${RED}Missing: $FAIL${NC}  |  ${YELLOW}Optional: $SKIP${NC}  |  Total: $TOTAL"
echo -e "${CYAN}══════════════════════════════════════════════${NC}"

if [ $FAIL -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Easiest fix — just use Docker:${NC}"
    echo "  docker compose up --build"
fi

echo ""

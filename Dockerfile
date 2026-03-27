# ═══════════════════════════════════════════════════════════════
# HYDRA INTEL — Dockerfile (no API keys needed)
#
# Only installs tools that work out of the box without paid/auth APIs.
# Build:  docker compose up --build -d
# Verify: docker exec hydra-intel python /app/scripts/verify_tools.py
# ═══════════════════════════════════════════════════════════════


# ══════════════════════════════════════════════════════════════
# STAGE 1 — Go CLI binaries
# ══════════════════════════════════════════════════════════════
FROM golang:1.24-bookworm AS go-builder

# DNS & subdomain enumeration (all free, no keys)
RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    go install -v github.com/projectdiscovery/katana/cmd/katana@latest && \
    go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest && \
    go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# GitHub secret scanning (works on local repos, no token needed)
RUN go install github.com/gitleaks/gitleaks/v8@latest && \
    go install github.com/trufflesecurity/trufflehog/v3@latest

# Recon & URL discovery (all free)
RUN go install -v github.com/owasp-amass/amass/v4/...@master && \
    go install github.com/tomnomnom/assetfinder@latest && \
    go install github.com/tomnomnom/waybackurls@latest && \
    go install github.com/lc/gau/v2/cmd/gau@latest


# ══════════════════════════════════════════════════════════════
# STAGE 2 — Frontend build
# ══════════════════════════════════════════════════════════════
FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --prefer-offline --no-audit 2>/dev/null || npm install
COPY frontend/ ./
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
RUN npm run build


# ══════════════════════════════════════════════════════════════
# STAGE 3 — Runtime
# ══════════════════════════════════════════════════════════════
FROM python:3.12-bookworm

LABEL maintainer="HYDRA INTEL"
LABEL description="OSINT Platform — free tools only, no API keys required"

# ── System packages ───────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    whois \
    dnsutils \
    bind9-host \
    traceroute \
    netcat-openbsd \
    tor \
    torsocks \
    proxychains4 \
    chromium \
    chromium-driver \
    git \
    curl \
    wget \
    jq \
    unzip \
    libmagic1 \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt1-dev \
    build-essential \
    nodejs \
    npm \
    libimage-exiftool-perl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Go binaries from Stage 1 ─────────────────────────────────
COPY --from=go-builder /go/bin/subfinder    /usr/local/bin/subfinder
COPY --from=go-builder /go/bin/httpx        /usr/local/bin/httpx
COPY --from=go-builder /go/bin/katana       /usr/local/bin/katana
COPY --from=go-builder /go/bin/dnsx         /usr/local/bin/dnsx
COPY --from=go-builder /go/bin/nuclei       /usr/local/bin/nuclei
COPY --from=go-builder /go/bin/gitleaks     /usr/local/bin/gitleaks
COPY --from=go-builder /go/bin/trufflehog   /usr/local/bin/trufflehog
COPY --from=go-builder /go/bin/amass        /usr/local/bin/amass
COPY --from=go-builder /go/bin/assetfinder  /usr/local/bin/assetfinder
COPY --from=go-builder /go/bin/waybackurls  /usr/local/bin/waybackurls
COPY --from=go-builder /go/bin/gau          /usr/local/bin/gau

WORKDIR /app

# ── Python core deps ─────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# ── Free OSINT Python tools (no API key needed) ──────────────

# Social media username OSINT (all free, scrape-based)
RUN pip install --no-cache-dir sherlock-project 2>/dev/null || true && \
    pip install --no-cache-dir maigret 2>/dev/null || true && \
    pip install --no-cache-dir social-analyzer 2>/dev/null || true && \
    pip install --no-cache-dir snscrape 2>/dev/null || true

# Email OSINT (holehe = free, no key)
RUN pip install --no-cache-dir holehe 2>/dev/null || true && \
    pip install --no-cache-dir h8mail 2>/dev/null || true

# DNS (dnstwist = free, dnsrecon = free)
RUN pip install --no-cache-dir dnstwist 2>/dev/null || true && \
    pip install --no-cache-dir dnsrecon 2>/dev/null || true

# Infrastructure (python-nmap = free, wraps local nmap)
RUN pip install --no-cache-dir python-nmap 2>/dev/null || true

# Reddit (json API = free, no key; praw needs key but lib install is free)
RUN pip install --no-cache-dir praw 2>/dev/null || true

# Telegram (telethon/pyrogram need auth but install is free)
RUN pip install --no-cache-dir telethon 2>/dev/null || true && \
    pip install --no-cache-dir pyrogram tgcrypto 2>/dev/null || true

# Dark web (tor + onionsearch = free, PySocks = free)
RUN pip install --no-cache-dir PySocks 2>/dev/null || true && \
    pip install --no-cache-dir onionsearch 2>/dev/null || true

# Vuln lookup (nvdlib = free NVD API, no key needed for basic)
RUN pip install --no-cache-dir nvdlib 2>/dev/null || true

# Web scraping (selenium = free with chromium)
RUN pip install --no-cache-dir selenium webdriver-manager 2>/dev/null || true

# YARA rules (free, local scanning)
RUN pip install --no-cache-dir yara-python 2>/dev/null || true

# IPinfo (free tier, 50k/month without key)
RUN pip install --no-cache-dir ipinfo 2>/dev/null || true && \
    pip install --no-cache-dir netlas 2>/dev/null || true

# Surface OSINT (theHarvester = free)
RUN pip install --no-cache-dir theHarvester 2>/dev/null || true

# Misc
RUN pip install --no-cache-dir python-dotenv aiofiles python-multipart 2>/dev/null || true

# ── Non-root user ────────────────────────────────────────────
RUN useradd -m -s /bin/bash hydra

# ── Copy app code ────────────────────────────────────────────
COPY config/ config/
COPY core/ core/
COPY collectors/ collectors/
COPY storage/ storage/
COPY pipelines/ pipelines/
COPY server/ server/
COPY scripts/ scripts/
COPY main.py run_server.py ./

# ── Copy frontend ────────────────────────────────────────────
COPY --from=frontend-builder /app/frontend/.next /app/frontend/.next
COPY --from=frontend-builder /app/frontend/public /app/frontend/public
COPY --from=frontend-builder /app/frontend/package.json /app/frontend/package.json
COPY --from=frontend-builder /app/frontend/node_modules /app/frontend/node_modules
COPY --from=frontend-builder /app/frontend/next.config.ts /app/frontend/next.config.ts

# ── Scripts ──────────────────────────────────────────────────
COPY setup.sh /app/setup.sh
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/setup.sh /app/entrypoint.sh /app/scripts/*.sh 2>/dev/null || true

# ── Directories & permissions ────────────────────────────────
RUN mkdir -p /app/logs /app/data /app/yara-rules && \
    chown -R hydra:hydra /app

# ── Tor config ───────────────────────────────────────────────
RUN echo "SocksPort 9050" > /etc/tor/torrc && \
    echo "ExitPolicy reject *:*" >> /etc/tor/torrc

# ── Verification script (copied from scripts/) ────────────
RUN chmod +x /app/scripts/verify_tools.py

# ── Ports ────────────────────────────────────────────────────
EXPOSE 8000 3000

# ── Health check ─────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# ── Env defaults ─────────────────────────────────────────────
ENV HYDRA_DB_TYPE=sqlite \
    HYDRA_DB_PATH=/app/data/intel.db \
    HYDRA_LOG_LEVEL=INFO \
    HYDRA_LOG_FILE=/app/logs/hydra.log \
    HYDRA_RATE_LIMIT=1.0 \
    HYDRA_MAX_RESULTS=50 \
    TOR_ENABLED=true \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

ENTRYPOINT ["/app/entrypoint.sh"]

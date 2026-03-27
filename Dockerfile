# ═══════════════════════════════════════════════════════════════
# HYDRA INTEL — Full Dockerfile (Tools + Backend + Frontend)
#
# Build:  docker compose up --build -d
# Shell:  docker exec -it hydra-intel bash
# Verify: docker exec hydra-intel python /app/scripts/verify_tools.py
# ═══════════════════════════════════════════════════════════════


# ══════════════════════════════════════════════════════════════
# STAGE 1 — Go CLI binaries
# ══════════════════════════════════════════════════════════════
FROM golang:1.24-bookworm AS go-builder

RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest || true
RUN go install -v github.com/projectdiscovery/httpx/cmd/httpx@v1.6.9 || true
RUN go install -v github.com/projectdiscovery/katana/cmd/katana@v1.1.0 || true
RUN go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@v1.2.1 || true
RUN go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@v3.3.7 || true
RUN go install github.com/gitleaks/gitleaks/v8@latest || true
RUN go install github.com/trufflesecurity/trufflehog/v3@latest || true
RUN go install -v github.com/owasp-amass/amass/v4/...@master || true
RUN go install github.com/tomnomnom/assetfinder@latest || true
RUN go install github.com/tomnomnom/waybackurls@latest || true
RUN go install github.com/lc/gau/v2/cmd/gau@latest || true


# ══════════════════════════════════════════════════════════════
# STAGE 2 — Runtime (tools + app)
# ══════════════════════════════════════════════════════════════
FROM python:3.12-bookworm

LABEL maintainer="HYDRA INTEL"
LABEL description="OSINT Platform — tools + backend + frontend"

# ── System packages ───────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap whois dnsutils bind9-host traceroute netcat-openbsd \
    tor torsocks proxychains4 \
    chromium chromium-driver \
    git curl wget jq unzip \
    libmagic1 libffi-dev libssl-dev libxml2-dev libxslt1-dev \
    build-essential libimage-exiftool-perl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 22 (for frontend) ────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# ── Go binaries from Stage 1 ─────────────────────────────────
COPY --from=go-builder /go/bin/ /tmp/gobin/
RUN cp /tmp/gobin/* /usr/local/bin/ 2>/dev/null || true && rm -rf /tmp/gobin

WORKDIR /app

# ── Python core deps ─────────────────────────────────────────
COPY requirements.docker.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.docker.txt

# ── Free OSINT Python tools ──────────────────────────────────
RUN pip install --no-cache-dir sherlock-project 2>/dev/null || true
RUN pip install --no-cache-dir maigret 2>/dev/null || true
RUN pip install --no-cache-dir social-analyzer 2>/dev/null || true
RUN pip install --no-cache-dir snscrape 2>/dev/null || true
RUN pip install --no-cache-dir holehe 2>/dev/null || true
RUN pip install --no-cache-dir h8mail 2>/dev/null || true
RUN pip install --no-cache-dir dnstwist 2>/dev/null || true
RUN pip install --no-cache-dir dnsrecon 2>/dev/null || true
RUN pip install --no-cache-dir python-nmap 2>/dev/null || true
RUN pip install --no-cache-dir telethon 2>/dev/null || true
RUN pip install --no-cache-dir pyrogram tgcrypto 2>/dev/null || true
RUN pip install --no-cache-dir praw 2>/dev/null || true
RUN pip install --no-cache-dir PySocks 2>/dev/null || true
RUN pip install --no-cache-dir onionsearch 2>/dev/null || true
RUN pip install --no-cache-dir nvdlib 2>/dev/null || true
RUN pip install --no-cache-dir selenium webdriver-manager 2>/dev/null || true
RUN pip install --no-cache-dir yara-python 2>/dev/null || true
RUN pip install --no-cache-dir ipinfo 2>/dev/null || true
RUN pip install --no-cache-dir netlas 2>/dev/null || true
RUN pip install --no-cache-dir shodan 2>/dev/null || true
RUN pip install --no-cache-dir theHarvester 2>/dev/null || true
RUN pip install --no-cache-dir python-dotenv aiofiles python-multipart 2>/dev/null || true

# ── Copy app code ─────────────────────────────────────────────
COPY config/ config/
COPY core/ core/
COPY collectors/ collectors/
COPY storage/ storage/
COPY pipelines/ pipelines/
COPY server/ server/
COPY scripts/ scripts/
COPY main.py run_server.py ./

# ── Install frontend deps & build ─────────────────────────────
COPY frontend/package.json frontend/package-lock.json* frontend/
RUN cd frontend && npm install --prefer-offline --no-audit 2>/dev/null || cd frontend && npm install
COPY frontend/ frontend/
RUN cd frontend && npm run build || true

# ── Scripts & permissions ─────────────────────────────────────
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && \
    chmod +x /app/scripts/*.py /app/scripts/*.sh 2>/dev/null || true

# ── Directories ───────────────────────────────────────────────
RUN mkdir -p /app/logs /app/data /app/yara-rules

# ── Tor config ────────────────────────────────────────────────
RUN echo "SocksPort 9050" > /etc/tor/torrc && \
    echo "ExitPolicy reject *:*" >> /etc/tor/torrc

# ── Env defaults ──────────────────────────────────────────────
ENV HYDRA_DB_TYPE=sqlite \
    HYDRA_DB_PATH=/app/data/intel.db \
    HYDRA_LOG_LEVEL=INFO \
    HYDRA_LOG_FILE=/app/logs/hydra.log \
    HYDRA_RATE_LIMIT=1.0 \
    HYDRA_MAX_RESULTS=50 \
    TOR_ENABLED=true \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8000 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]

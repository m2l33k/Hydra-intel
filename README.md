# HYDRA INTEL

HYDRA INTEL is a Python-based OSINT collection engine with a FastAPI backend and Next.js frontend for monitoring threat intelligence signals (leaks, CVEs, mentions, and alerts).

## OSINT Tools and Specifications

### 1) GitHub Collector (`github`)
- File: `collectors/github_collector.py`
- Source Type: API-based OSINT (GitHub public search)
- Endpoints:
  - `https://api.github.com/search/code`
  - `https://api.github.com/search/repositories`
- Authentication: Optional `GITHUB_TOKEN` (recommended to avoid low anonymous limits)
- Query Mode:
  - Code search query (example: `api_key filename:.env`)
  - Repo search via `search_repos()`
- Built-in limits:
  - `per_page` capped at 30 for code search
  - Respects global retry and rate-limit delay
- Output:
  - `type`: `leak` or `code`
  - Metadata includes repo, file path, SHA, score, matched keywords

### 2) CVE Collector (`cve`)
- File: `collectors/cve_collector.py`
- Source Type: Vulnerability intelligence feeds
- Endpoints:
  - Primary: `https://cve.circl.lu/api/last` or `/api/search/<query>`
  - Fallback: `https://services.nvd.nist.gov/rest/json/cves/2.0`
- Authentication: None required
- Query Mode:
  - Empty query = recent CVEs
  - Keyword query (example: `apache`, `rce`)
- Built-in behavior:
  - CIRCL first, automatic fallback to NVD
- Output:
  - `type`: `vuln`
  - Metadata includes CVE ID, CVSS, CWE, published/modified dates

### 3) Reddit Collector (`reddit`)
- File: `collectors/reddit_collector.py`
- Source Type: Community/social OSINT
- Endpoints:
  - JSON search: `https://www.reddit.com/r/<subs>/search.json`
  - HTML fallback: `https://old.reddit.com/r/<subreddit>/search`
- Authentication:
  - Currently works with public endpoints
  - `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` are available in config for future OAuth hardening
- Default monitored subreddits:
  - `netsec`, `cybersecurity`, `hacking`, `AskNetsec`, `InfoSecNews`, `malware`, `ReverseEngineering`
- Classification:
  - `mention`, `alert`, `leak`, `vuln` based on keyword/title matching
- Output metadata:
  - Subreddit, author, score/comments, post time, matched keywords

### 4) Pastebin Collector (`pastebin`)
- File: `collectors/pastebin_collector.py`
- Source Type: Paste monitoring OSINT
- Endpoints:
  - `https://scrape.pastebin.com/api_scraping.php`
  - `https://scrape.pastebin.com/api_scrape_item.php`
- Authentication: None, but production scraping API may require whitelisted IP
- Query Mode:
  - Optional keyword filter across title + fetched paste content
- Built-in limits:
  - Collector default caps results to <= 50 unless overridden
- Output:
  - `type`: `paste` or `leak`
  - Metadata includes paste key, syntax, size, date, expire, user

## Common Intel Record Specification
All collectors return normalized records with this core shape:

```json
{
  "source": "github|cve|reddit|pastebin",
  "type": "leak|vuln|mention|alert|paste|code",
  "title": "string",
  "content": "string",
  "url": "string",
  "collected_at": "ISO-8601 UTC",
  "metadata": {}
}
```

## Tooling Stack
- HTTP and retry: `requests`, `urllib3` (retry/backoff)
- HTML parsing: `beautifulsoup4` (+ `lxml`)
- Core client: `core/http_client.py` (timeout, retries, rotating User-Agent, optional proxy)
- Parser utilities: `core/parser.py`

## Quick Start

### Backend setup
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Run OSINT collection pipeline
```bash
python main.py
python main.py --source github --query "api_key filename:.env"
python main.py --source cve --query "rce" --max-results 25
python main.py --mode concurrent --max-results 50
```

### Run API server
```bash
python run_server.py
```
- API docs: `http://localhost:8000/docs`

## Key Configuration (Environment Variables)
- `GITHUB_TOKEN`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `HYDRA_MAX_RESULTS`
- `HYDRA_TIMEOUT`
- `HYDRA_MAX_RETRIES`
- `HYDRA_RETRY_BACKOFF`
- `HYDRA_RATE_LIMIT`
- `HYDRA_PROXY_URL`
- `HYDRA_DB_PATH`

## API Surface (for frontend/integrations)
- `/api/health`
- `/api/dashboard/*`
- `/api/threats/*`
- `/api/collectors/*`
- `/api/search`
- `/api/settings/*`
- WebSocket route from `server/routes/websocket.py`

## Optional/Planned OSINT Extensions
The dependency file already hints at future expansion:
- `scrapy` for larger crawl workflows
- `playwright` for dynamic page rendering
- async queue stack (`celery`, `redis`, `aiohttp`)
- PostgreSQL backend (`sqlalchemy`, `psycopg2-binary`)

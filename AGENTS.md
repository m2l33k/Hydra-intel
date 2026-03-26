# Repository Guidelines

## Mission & Operating Boundaries
HYDRA is a passive intelligence platform. Contributions must stay within legal OSINT collection: public data, documented APIs, and non-intrusive scraping. Do not add active exploitation, credential testing, bypass tooling, or unauthorized access logic.

## Intelligence Architecture
- `collectors/`: source adapters (`*_collector.py`) extending `BaseCollector`.
- `pipelines/intel_pipeline.py`: sequential/concurrent execution and dedup flow.
- `core/`: HTTP resilience, parsing, normalization, logging.
- `storage/database.py`: SQLite persistence (`intel.db`).
- `server/`: FastAPI routes/services for dashboard, search, threats, websocket.
- `frontend/src/`: SOC UI (App Router pages, components, charts/graph views).

## Collector Engineering Standard
For each new source:
1. Create `collectors/<source>_collector.py` and implement `source_name` + `collect(query, max_results)`.
2. Use `HttpClient` (retry, timeout, UA rotation), never raw `requests` calls.
3. Return normalized records with at least: `source`, `type`, `title`, `content`, `url`, `collected_at`, `metadata`.
4. Add source-specific metadata (`indicator_type`, `confidence`, `first_seen`, `tags`) when available.
5. Fail soft: log and append collector errors via `_add_error`, do not crash pipeline.

## Build & Ops Commands
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run_server.py                           # API + /docs
python main.py --mode concurrent --max-results 25
python main.py --source github --query "api_key filename:.env"
```
Frontend (`frontend/`):
```bash
npm install
npx next dev
npx next build
npx tsc --noEmit
```

## Data Quality, Triage, and Noise Control
- Prefer high-signal results: keep precise query defaults per source.
- Deduplicate by stable identity (`url`, source ID, hashable key).
- Preserve provenance in `metadata` (source endpoint, timestamps, match context).
- Classify consistently (`leak`, `vuln`, `mention`, `alert`, `paste`).
- Avoid over-alerting: only escalate when keyword/context confidence is meaningful.

## Testing & Validation
No full automated suite is committed yet; new OSINT features must include:
- Backend tests in `tests/test_<source>_collector.py` with mocked HTTP payloads.
- Parsing tests for malformed HTML/JSON edge cases.
- Manual verification run with representative queries and duplicate checks.
- Frontend/type gate: `npx tsc --noEmit`.

## Security, Secrets, and OPSEC
Use env vars only (`GITHUB_TOKEN`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `HYDRA_*`). Never commit secrets, raw sensitive dumps, or deanonymizing operator details. Respect source rate limits and terms of service.

## Commits & PRs
Use Conventional Commits (`feat:`, `fix:`, `chore:`). PRs must include: source(s) changed, sample query used, expected record shape, risk/false-positive notes, and screenshots for UI changes.

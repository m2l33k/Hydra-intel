"""
HYDRA INTEL - Configuration Settings

All configurable parameters for the intelligence engine.
Reads from environment variables with sensible defaults.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Settings:
    """Central configuration for HYDRA INTEL."""

    # --- General ---
    app_name: str = "HYDRA INTEL"
    app_version: str = "1.0.0"
    debug: bool = field(default_factory=lambda: os.getenv("HYDRA_DEBUG", "false").lower() == "true")

    # --- Database ---
    db_type: str = field(default_factory=lambda: os.getenv("HYDRA_DB_TYPE", "sqlite"))
    db_path: str = field(default_factory=lambda: os.getenv("HYDRA_DB_PATH", "intel.db"))
    db_url: Optional[str] = field(default_factory=lambda: os.getenv("HYDRA_DB_URL"))

    # --- HTTP Client ---
    request_timeout: int = field(default_factory=lambda: int(os.getenv("HYDRA_TIMEOUT", "30")))
    max_retries: int = field(default_factory=lambda: int(os.getenv("HYDRA_MAX_RETRIES", "3")))
    retry_backoff: float = field(default_factory=lambda: float(os.getenv("HYDRA_RETRY_BACKOFF", "1.5")))
    proxy_url: Optional[str] = field(default_factory=lambda: os.getenv("HYDRA_PROXY_URL"))

    # --- Rate Limiting ---
    rate_limit_delay: float = field(default_factory=lambda: float(os.getenv("HYDRA_RATE_LIMIT", "1.0")))

    # --- API Keys (optional, for authenticated access) ---
    github_token: Optional[str] = field(default_factory=lambda: os.getenv("GITHUB_TOKEN"))
    reddit_client_id: Optional[str] = field(default_factory=lambda: os.getenv("REDDIT_CLIENT_ID"))
    reddit_client_secret: Optional[str] = field(default_factory=lambda: os.getenv("REDDIT_CLIENT_SECRET"))

    # --- Collectors ---
    default_max_results: int = field(default_factory=lambda: int(os.getenv("HYDRA_MAX_RESULTS", "50")))
    concurrency_mode: str = field(default_factory=lambda: os.getenv("HYDRA_CONCURRENCY", "async"))

    # --- Keyword Filters ---
    alert_keywords: list = field(default_factory=lambda: [
        "password", "api_key", "apikey", "secret", "token",
        "credential", "leak", "breach", "exploit", "vulnerability",
        "0day", "zero-day", "backdoor", "ransomware", "phishing",
    ])

    # --- Logging ---
    log_level: str = field(default_factory=lambda: os.getenv("HYDRA_LOG_LEVEL", "INFO"))
    log_file: str = field(default_factory=lambda: os.getenv("HYDRA_LOG_FILE", "logs/hydra.log"))

    # --- User Agent Rotation Pool ---
    user_agents: list = field(default_factory=lambda: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    ])

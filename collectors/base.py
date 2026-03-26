"""
HYDRA INTEL - Base Collector

Abstract base class that all collectors must implement.
Ensures a consistent interface across all data sources.
"""

import time
from abc import ABC, abstractmethod
from typing import Optional

from config import settings
from core.http_client import HttpClient
from core.logger import get_logger

logger = get_logger(__name__)


class BaseCollector(ABC):
    """Abstract base for all intelligence collectors.

    Every collector must implement:
        - collect(query, max_results) -> list[dict]
        - source_name property

    The base class provides shared HTTP client, rate limiting,
    and keyword filtering.
    """

    def __init__(self, http_client: Optional[HttpClient] = None):
        self.client = http_client or HttpClient()
        self._errors: list[str] = []

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Unique identifier for this data source (e.g., 'github', 'cve')."""
        ...

    @abstractmethod
    def collect(self, query: str, max_results: int = 0) -> list[dict]:
        """Collect raw intelligence data for a given query.

        Args:
            query: Search keyword or query string.
            max_results: Maximum items to return (0 = use default).

        Returns:
            List of raw data dicts with at minimum:
            source, type, title, content, url.
        """
        ...

    @property
    def errors(self) -> list[str]:
        """Errors accumulated during the last collection run."""
        return self._errors

    def _add_error(self, message: str):
        """Record a non-fatal error."""
        self._errors.append(message)
        logger.warning("[%s] %s", self.source_name, message)

    def _rate_limit(self):
        """Respect rate limiting between requests."""
        delay = settings.rate_limit_delay
        if delay > 0:
            time.sleep(delay)

    def _matches_keywords(self, text: str) -> list[str]:
        """Check if text contains any alert keywords.

        Args:
            text: Text to scan.

        Returns:
            List of matched keywords.
        """
        if not text:
            return []
        text_lower = text.lower()
        return [kw for kw in settings.alert_keywords if kw in text_lower]

    def reset(self):
        """Reset error state for a new collection run."""
        self._errors = []

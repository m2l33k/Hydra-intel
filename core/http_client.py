"""
HYDRA INTEL - HTTP Client

Resilient HTTP client with header rotation, retry logic,
timeout handling, and proxy support.
"""

import random
import time
from typing import Any, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from config import settings
from core.logger import get_logger

logger = get_logger(__name__)


class HttpClient:
    """Resilient HTTP client for intelligence collection.

    Features:
        - User-Agent rotation
        - Configurable timeout and retries with exponential backoff
        - Proxy support (design-ready)
        - Session reuse for connection pooling
    """

    def __init__(
        self,
        timeout: Optional[int] = None,
        max_retries: Optional[int] = None,
        proxy_url: Optional[str] = None,
    ):
        self.timeout = timeout or settings.request_timeout
        self.max_retries = max_retries or settings.max_retries
        self.proxy_url = proxy_url or settings.proxy_url
        self.session = self._build_session()

    def _build_session(self) -> requests.Session:
        """Build a requests session with retry strategy and optional proxy."""
        session = requests.Session()

        retry_strategy = Retry(
            total=self.max_retries,
            backoff_factor=settings.retry_backoff,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "HEAD"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)

        if self.proxy_url:
            session.proxies = {
                "http": self.proxy_url,
                "https": self.proxy_url,
            }
            logger.info("Proxy configured: %s", self.proxy_url)

        return session

    def _rotate_headers(self, extra_headers: Optional[dict] = None) -> dict:
        """Generate request headers with a rotated User-Agent."""
        headers = {
            "User-Agent": random.choice(settings.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        }
        if extra_headers:
            headers.update(extra_headers)
        return headers

    def get(
        self,
        url: str,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> Optional[requests.Response]:
        """Perform an HTTP GET request with resilience features.

        Args:
            url: Target URL.
            params: Query parameters.
            headers: Additional headers (merged with rotated defaults).

        Returns:
            Response object or None on failure.
        """
        request_headers = self._rotate_headers(headers)
        try:
            logger.debug("GET %s", url)
            response = self.session.get(
                url,
                params=params,
                headers=request_headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
            logger.debug("Response %d from %s (%d bytes)", response.status_code, url, len(response.content))
            return response
        except requests.exceptions.HTTPError as e:
            logger.warning("HTTP error for %s: %s", url, e)
        except requests.exceptions.ConnectionError as e:
            logger.error("Connection error for %s: %s", url, e)
        except requests.exceptions.Timeout:
            logger.error("Timeout after %ds for %s", self.timeout, url)
        except requests.exceptions.RequestException as e:
            logger.error("Request failed for %s: %s", url, e)
        return None

    def get_json(
        self,
        url: str,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> Optional[Any]:
        """Perform GET and return parsed JSON.

        Returns:
            Parsed JSON (dict/list) or None on failure.
        """
        response = self.get(url, params=params, headers=headers)
        if response is None:
            return None
        try:
            return response.json()
        except ValueError:
            logger.error("Invalid JSON response from %s", url)
            return None

    def close(self):
        """Close the underlying session."""
        self.session.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

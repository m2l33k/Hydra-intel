"""
HYDRA INTEL - Pastebin Collector

Monitors Pastebin scraping API for security-relevant pastes.
"""

from typing import Optional
from datetime import datetime, timezone

from collectors.enhanced_base import EnhancedBaseCollector
from config import settings
from core.http_client import HttpClient
from core.logger import get_logger
from core.signatures import SignatureScanner
from core.tool_manager import ToolManager
from core.tool_registry import TargetType

logger = get_logger(__name__)

PASTEBIN_SCRAPE_URL = "https://scrape.pastebin.com/api_scraping.php"
PASTEBIN_SCRAPE_ITEM_URL = "https://scrape.pastebin.com/api_scrape_item.php"


class PastebinCollector(EnhancedBaseCollector):
    """Collect intelligence from Pastebin pastes."""

    def __init__(
        self,
        http_client: Optional[HttpClient] = None,
        tool_manager: Optional[ToolManager] = None,
        scanner: Optional[SignatureScanner] = None,
        use_tool_registry: bool = True,
    ):
        super().__init__(tool_manager=tool_manager, http_client=http_client, scanner=scanner)
        self.use_tool_registry = use_tool_registry
        logger.info("Pastebin collector initialized")

    @property
    def source_name(self) -> str:
        return "pastebin"

    @property
    def target_type(self) -> TargetType:
        return TargetType.PASTE_LEAKS

    @property
    def default_query(self) -> str:
        return "password"

    def collect(
        self,
        query: str = "",
        max_results: int = 0,
        preferred_tool: Optional[str] = None,
        use_tool_registry: Optional[bool] = None,
        scan_signatures: bool = True,
        **kwargs,
    ) -> list[dict]:
        """Scrape recent Pastebin pastes and filter by keyword."""
        max_results = max_results or min(settings.default_max_results, 50)
        use_registry = self.use_tool_registry if use_tool_registry is None else use_tool_registry

        if use_registry:
            return super().collect(
                query=query,
                max_results=max_results,
                preferred_tool=preferred_tool,
                scan_signatures=scan_signatures,
                **kwargs,
            )

        return self._collect_direct(query, max_results)

    def _collect_direct(self, query: str = "", max_results: int = 0) -> list[dict]:
        """Direct Pastebin API collection path used by tool executors."""
        self.reset()
        results = []

        data = self.client.get_json(
            PASTEBIN_SCRAPE_URL,
            params={"limit": min(max_results * 2, 250)},
        )

        if not data or not isinstance(data, list):
            self._add_error("Pastebin scraping API unavailable (IP may not be whitelisted)")
            logger.warning("Pastebin scraping API requires a whitelisted IP for production use")
            return results

        for paste in data:
            if len(results) >= max_results:
                break

            title = paste.get("title", "Untitled")
            paste_key = paste.get("key", "")
            paste_url = paste.get("full_url", f"https://pastebin.com/{paste_key}")
            syntax = paste.get("syntax", "")
            size = paste.get("size", 0)

            content = ""
            if paste_key:
                content_resp = self.client.get(
                    PASTEBIN_SCRAPE_ITEM_URL,
                    params={"i": paste_key},
                )
                if content_resp:
                    content = content_resp.text[:5000]
                self._rate_limit()

            full_text = f"{title} {content}"

            if query and query.lower() not in full_text.lower():
                continue

            matched_keywords = self._matches_keywords(full_text)
            intel_type = "leak" if matched_keywords else "paste"

            record = {
                "source": self.source_name,
                "type": intel_type,
                "title": title or f"Paste {paste_key}",
                "content": content,
                "url": paste_url,
                "collected_at": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "paste_key": paste_key,
                    "syntax": syntax,
                    "size": int(size),
                    "date": paste.get("date", ""),
                    "expire": paste.get("expire", ""),
                    "user": paste.get("user", "anonymous"),
                    "matched_keywords": matched_keywords,
                },
            }
            results.append(record)

        logger.info("Pastebin collector returned %d results for query '%s'", len(results), query or "*")
        return results

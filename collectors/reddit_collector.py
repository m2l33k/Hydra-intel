"""
HYDRA INTEL - Reddit Collector

Collects security-related posts from Reddit. Supports two modes:
1. Tool-manager path with automatic fallback across Reddit tools.
2. Direct JSON/HTML collection as fallback execution path.
"""

from typing import Optional
from datetime import datetime, timezone

from collectors.enhanced_base import EnhancedBaseCollector
from config import settings
from core.http_client import HttpClient
from core.parser import Parser
from core.logger import get_logger
from core.signatures import SignatureScanner
from core.tool_manager import ToolManager
from core.tool_registry import TargetType

logger = get_logger(__name__)

DEFAULT_SUBREDDITS = [
    "netsec",
    "cybersecurity",
    "hacking",
    "AskNetsec",
    "InfoSecNews",
    "malware",
    "ReverseEngineering",
]

REDDIT_HEADERS = {
    "User-Agent": "HYDRA-INTEL/1.0 (Threat Intelligence Research Platform)",
}


class RedditCollector(EnhancedBaseCollector):
    """Collect security-related intelligence from Reddit."""

    def __init__(
        self,
        http_client: Optional[HttpClient] = None,
        subreddits: Optional[list[str]] = None,
        tool_manager: Optional[ToolManager] = None,
        scanner: Optional[SignatureScanner] = None,
        use_tool_registry: bool = True,
    ):
        super().__init__(tool_manager=tool_manager, http_client=http_client, scanner=scanner)
        self.subreddits = subreddits or DEFAULT_SUBREDDITS
        self.use_tool_registry = use_tool_registry
        logger.info("Reddit collector initialized with %d subreddits", len(self.subreddits))

    @property
    def source_name(self) -> str:
        return "reddit"

    @property
    def target_type(self) -> TargetType:
        return TargetType.REDDIT_INTEL

    @property
    def default_query(self) -> str:
        return "data breach OR vulnerability OR exploit"

    def collect(
        self,
        query: str,
        max_results: int = 0,
        preferred_tool: Optional[str] = None,
        use_tool_registry: Optional[bool] = None,
        scan_signatures: bool = True,
        **kwargs,
    ) -> list[dict]:
        """Search Reddit for security-related posts."""
        max_results = max_results or settings.default_max_results
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

    def _collect_direct(self, query: str, max_results: int) -> list[dict]:
        """Direct Reddit collection path used by tool executors."""
        self.reset()

        results = self._collect_json(query, max_results)
        if not results:
            logger.info("Reddit JSON API unavailable, falling back to HTML scraping")
            results = self._collect_html(query, max_results)

        logger.info("Reddit collector returned %d results for query '%s'", len(results), query)
        return results

    def _collect_json(self, query: str, max_results: int) -> list[dict]:
        subreddit_str = "+".join(self.subreddits)
        url = f"https://www.reddit.com/r/{subreddit_str}/search.json"

        data = self.client.get_json(
            url,
            params={
                "q": query,
                "sort": "new",
                "limit": min(max_results, 100),
                "restrict_sr": "on",
                "t": "month",
            },
            headers=REDDIT_HEADERS,
        )

        if data is None or "data" not in data:
            return []

        results = []
        for post in data.get("data", {}).get("children", [])[:max_results]:
            record = self._parse_json_post(post.get("data", {}))
            if record:
                results.append(record)
        return results

    def _collect_html(
        self,
        query: str,
        max_results: int,
        subreddits: Optional[list[str]] = None,
    ) -> list[dict]:
        """Scrape Reddit search results from old.reddit.com HTML."""
        results = []
        target_subreddits = subreddits or self.subreddits

        for subreddit in target_subreddits:
            if len(results) >= max_results:
                break

            url = f"https://old.reddit.com/r/{subreddit}/search"
            response = self.client.get(
                url,
                params={
                    "q": query,
                    "restrict_sr": "on",
                    "sort": "new",
                    "t": "month",
                },
                headers=REDDIT_HEADERS,
            )

            if response is None:
                self._add_error(f"Failed to scrape r/{subreddit}")
                continue

            soup = Parser.parse_html(response.text)
            if not soup:
                continue

            post_elements = soup.select("div.search-result")
            if not post_elements:
                post_elements = soup.select("div.thing")

            for el in post_elements:
                if len(results) >= max_results:
                    break

                record = self._parse_html_post(el, subreddit)
                if record:
                    results.append(record)

            self._rate_limit()

        return results

    def _parse_json_post(self, post_data: dict) -> Optional[dict]:
        title = post_data.get("title", "")
        if not title:
            return None

        selftext = post_data.get("selftext", "")
        permalink = post_data.get("permalink", "")
        url = f"https://www.reddit.com{permalink}" if permalink else post_data.get("url", "")

        content = selftext[:5000] if selftext else ""
        full_text = f"{title} {content}"
        matched_keywords = self._matches_keywords(full_text)

        intel_type = self._classify_type(title, matched_keywords)

        created_utc = post_data.get("created_utc", 0)
        post_time = datetime.fromtimestamp(created_utc, tz=timezone.utc).isoformat() if created_utc else None

        return {
            "source": self.source_name,
            "type": intel_type,
            "title": title,
            "content": content,
            "url": url,
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "subreddit": post_data.get("subreddit", ""),
                "author": post_data.get("author", "[deleted]"),
                "score": post_data.get("score", 0),
                "num_comments": post_data.get("num_comments", 0),
                "post_time": post_time,
                "matched_keywords": matched_keywords,
            },
        }

    def _parse_html_post(self, element, subreddit: str) -> Optional[dict]:
        title_el = element.select_one("a.search-title") or element.select_one("a.title")
        if not title_el:
            return None

        title = Parser.clean_text(title_el.get_text())
        href = title_el.get("href", "")

        if href and not href.startswith("http"):
            href = f"https://old.reddit.com{href}"

        snippet_el = element.select_one("span.search-result-body") or element.select_one("div.md")
        content = Parser.clean_text(snippet_el.get_text()) if snippet_el else ""

        full_text = f"{title} {content}"
        matched_keywords = self._matches_keywords(full_text)
        intel_type = self._classify_type(title, matched_keywords)

        author_el = element.select_one("a.author")
        author = author_el.get_text() if author_el else "unknown"

        score_el = element.select_one("span.search-score") or element.select_one("div.score")
        score_text = score_el.get_text() if score_el else "0"

        return {
            "source": self.source_name,
            "type": intel_type,
            "title": title,
            "content": content[:5000],
            "url": href,
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "subreddit": subreddit,
                "author": author,
                "score_text": score_text,
                "matched_keywords": matched_keywords,
            },
        }

    @staticmethod
    def _classify_type(title: str, matched_keywords: list[str]) -> str:
        if not matched_keywords:
            return "mention"

        lower_title = title.lower()
        if any(w in lower_title for w in ["leak", "breach", "exposed", "dump"]):
            return "leak"
        if any(w in lower_title for w in ["vuln", "cve", "exploit", "0day"]):
            return "vuln"
        return "alert"

    def collect_subreddit(
        self,
        subreddit: str,
        sort: str = "new",
        max_results: int = 0,
    ) -> list[dict]:
        """Collect latest posts from a specific subreddit via HTML."""
        self.reset()
        max_results = max_results or settings.default_max_results
        results = []

        url = f"https://old.reddit.com/r/{subreddit}/{sort}"
        response = self.client.get(url, headers=REDDIT_HEADERS)

        if response is None:
            self._add_error(f"Failed to fetch r/{subreddit}")
            return results

        soup = Parser.parse_html(response.text)
        if not soup:
            return results

        for el in soup.select("div.thing")[:max_results]:
            record = self._parse_html_post(el, subreddit)
            if record:
                results.append(record)

        logger.info("Reddit r/%s returned %d posts", subreddit, len(results))
        return results

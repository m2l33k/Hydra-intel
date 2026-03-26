"""
HYDRA INTEL - GitHub Collector

Searches GitHub code and repositories for potential leaks,
exposed credentials, and security-relevant code snippets.

Uses the GitHub Search API (authenticated if GITHUB_TOKEN is set).
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

GITHUB_SEARCH_CODE_URL = "https://api.github.com/search/code"
GITHUB_SEARCH_REPOS_URL = "https://api.github.com/search/repositories"


class GitHubCollector(EnhancedBaseCollector):
    """Collect intelligence from GitHub code search."""

    def __init__(
        self,
        http_client: Optional[HttpClient] = None,
        tool_manager: Optional[ToolManager] = None,
        scanner: Optional[SignatureScanner] = None,
        use_tool_registry: bool = True,
    ):
        super().__init__(tool_manager=tool_manager, http_client=http_client, scanner=scanner)
        self.use_tool_registry = use_tool_registry
        self._headers = {"Accept": "application/vnd.github.v3.text-match+json"}
        if settings.github_token:
            self._headers["Authorization"] = f"token {settings.github_token}"
            logger.info("GitHub collector initialized with authentication")
        else:
            logger.info("GitHub collector initialized (unauthenticated - rate limits apply)")

    @property
    def source_name(self) -> str:
        return "github"

    @property
    def target_type(self) -> TargetType:
        return TargetType.GITHUB_INTEL

    @property
    def default_query(self) -> str:
        return "api_key filename:.env"

    def collect(
        self,
        query: str,
        max_results: int = 0,
        preferred_tool: Optional[str] = None,
        use_tool_registry: Optional[bool] = None,
        scan_signatures: bool = True,
        **kwargs,
    ) -> list[dict]:
        """Search GitHub code for a query."""
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
        """Direct GitHub API collection path used by tool executors."""
        self.reset()
        results = []

        per_page = min(max_results, 30)
        pages_needed = (max_results + per_page - 1) // per_page

        for page in range(1, pages_needed + 1):
            if len(results) >= max_results:
                break

            data = self.client.get_json(
                GITHUB_SEARCH_CODE_URL,
                params={
                    "q": query,
                    "per_page": per_page,
                    "page": page,
                    "sort": "indexed",
                    "order": "desc",
                },
                headers=self._headers,
            )

            if data is None:
                self._add_error(f"GitHub API returned no data for page {page}")
                break

            if "items" not in data:
                message = data.get("message", "Unknown error")
                self._add_error(f"GitHub API error: {message}")
                break

            for item in data["items"]:
                if len(results) >= max_results:
                    break

                fragments = []
                for match in item.get("text_matches", []):
                    fragments.append(match.get("fragment", ""))
                content = "\n---\n".join(fragments) if fragments else ""

                repo_name = item.get("repository", {}).get("full_name", "unknown")
                file_path = item.get("path", "")
                html_url = item.get("html_url", "")

                matched_keywords = self._matches_keywords(f"{content} {file_path} {query}")

                record = {
                    "source": self.source_name,
                    "type": "leak" if matched_keywords else "code",
                    "title": f"{repo_name}/{file_path}",
                    "content": content,
                    "url": html_url,
                    "collected_at": datetime.now(timezone.utc).isoformat(),
                    "metadata": {
                        "repo": repo_name,
                        "file_path": file_path,
                        "file_name": item.get("name", ""),
                        "sha": item.get("sha", ""),
                        "score": item.get("score", 0),
                        "matched_keywords": matched_keywords,
                    },
                }
                results.append(record)

            self._rate_limit()

        logger.info("GitHub collector returned %d results for query '%s'", len(results), query)
        return results

    def search_repos(self, query: str, max_results: int = 0) -> list[dict]:
        """Search GitHub repositories by keyword."""
        self.reset()
        max_results = max_results or settings.default_max_results
        results = []

        data = self.client.get_json(
            GITHUB_SEARCH_REPOS_URL,
            params={
                "q": query,
                "per_page": min(max_results, 100),
                "sort": "updated",
                "order": "desc",
            },
            headers=self._headers,
        )

        if data is None or "items" not in data:
            self._add_error("GitHub repo search failed")
            return results

        for item in data["items"][:max_results]:
            description = item.get("description") or ""
            matched_keywords = self._matches_keywords(f"{description} {item.get('name', '')}")

            record = {
                "source": self.source_name,
                "type": "mention",
                "title": item.get("full_name", ""),
                "content": description,
                "url": item.get("html_url", ""),
                "collected_at": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "stars": item.get("stargazers_count", 0),
                    "forks": item.get("forks_count", 0),
                    "language": item.get("language"),
                    "updated_at": item.get("updated_at"),
                    "matched_keywords": matched_keywords,
                },
            }
            results.append(record)

        logger.info("GitHub repo search returned %d results for '%s'", len(results), query)
        return results

"""
HYDRA INTEL — Tool Manager

Orchestrates tool selection, execution with automatic failover,
health monitoring, and runtime performance tracking.
"""

import time
import threading
from typing import Dict, List, Optional, Any, Callable, Tuple
from dataclasses import dataclass, field

from core.logger import get_logger
from core.tool_registry import (
    ToolRegistry, ToolDefinition, ToolStatus, TargetType, ToolType
)

logger = get_logger("tool_manager")


# ---------------------------------------------------------------------------
# Execution result
# ---------------------------------------------------------------------------

@dataclass
class ToolExecutionResult:
    """Result of running a tool."""
    success: bool
    tool_name: str
    target_type: str
    data: List[dict] = field(default_factory=list)
    error: Optional[str] = None
    elapsed: float = 0.0
    fallback_used: bool = False
    tools_tried: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "tool_name": self.tool_name,
            "target_type": self.target_type,
            "items_collected": len(self.data),
            "error": self.error,
            "elapsed": round(self.elapsed, 3),
            "fallback_used": self.fallback_used,
            "tools_tried": self.tools_tried,
            "warnings": self.warnings,
        }


# ---------------------------------------------------------------------------
# Tool executor registry — maps tool names to actual implementation functions
# ---------------------------------------------------------------------------

class ToolExecutorRegistry:
    """
    Maps tool names to their implementation functions.
    Each executor is a callable: (tool_def, query, max_results, **kwargs) -> List[dict]
    """

    def __init__(self):
        self._executors: Dict[str, Callable] = {}

    def register(self, tool_name: str, executor: Callable):
        self._executors[tool_name] = executor

    def get(self, tool_name: str) -> Optional[Callable]:
        return self._executors.get(tool_name)

    def has_executor(self, tool_name: str) -> bool:
        return tool_name in self._executors

    def list_registered(self) -> List[str]:
        return list(self._executors.keys())


# ---------------------------------------------------------------------------
# Tool Manager
# ---------------------------------------------------------------------------

class ToolManager:
    """
    Manages tool lifecycle: selection, execution, failover, and health tracking.

    Usage:
        manager = ToolManager()
        manager.initialize()  # Check all tool availability
        result = manager.run(TargetType.GITHUB_INTEL, query="api_key", max_results=50)
    """

    def __init__(self, registry: Optional[ToolRegistry] = None):
        self.registry = registry or ToolRegistry()
        self.executor_registry = ToolExecutorRegistry()
        self._lock = threading.Lock()
        self._initialized = False

        # Health monitoring
        self._health_check_interval = 300  # seconds
        self._last_health_check: Dict[str, float] = {}

        # Circuit breaker settings
        self._circuit_breaker_threshold = 5  # consecutive failures to open circuit
        self._circuit_breaker_timeout = 60   # seconds before retry after circuit open
        self._circuit_open_since: Dict[str, float] = {}

        # Register built-in executors
        self._register_builtin_executors()

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def initialize(self) -> Dict[str, str]:
        """
        Check availability of all tools and return status report.
        Should be called at application startup.
        """
        logger.info("Initializing tool manager — checking all tool availability...")
        results = self.registry.check_all_availability()

        available = sum(1 for s in results.values() if s == "available")
        auth_req = sum(1 for s in results.values() if s == "auth_required")
        unavailable = sum(1 for s in results.values() if s == "unavailable")

        logger.info(
            "Tool initialization complete: %d available, %d auth_required, %d unavailable (total: %d)",
            available, auth_req, unavailable, len(results)
        )

        self._initialized = True
        return results

    # ------------------------------------------------------------------
    # Tool execution with failover
    # ------------------------------------------------------------------

    def run(
        self,
        target_type: TargetType,
        query: str = "",
        max_results: int = 50,
        preferred_tool: Optional[str] = None,
        **kwargs,
    ) -> ToolExecutionResult:
        """
        Execute the best available tool for a target type.
        Automatically falls back to alternatives on failure.

        Args:
            target_type: What kind of intelligence to collect
            query: Search query
            max_results: Maximum results to return
            preferred_tool: Force a specific tool (skips auto-selection)
            **kwargs: Additional arguments passed to the tool executor
        """
        start = time.time()
        tools_tried = []
        warnings = []

        # Get fallback chain
        if preferred_tool:
            tool = self.registry.get_tool(preferred_tool)
            if not tool:
                return ToolExecutionResult(
                    success=False,
                    tool_name=preferred_tool,
                    target_type=target_type.value,
                    error=f"Tool '{preferred_tool}' not found in registry",
                    elapsed=time.time() - start,
                )
            chain = [tool] + [
                t for t in self.registry.get_fallback_chain(target_type)
                if t.name != preferred_tool
            ]
        else:
            chain = self.registry.get_fallback_chain(target_type)

        if not chain:
            return ToolExecutionResult(
                success=False,
                tool_name="none",
                target_type=target_type.value,
                error=f"No tools available for target type '{target_type.value}'",
                elapsed=time.time() - start,
            )

        # Try each tool in the chain
        last_error = None
        for tool in chain:
            # Circuit breaker check
            if self._is_circuit_open(tool.name):
                warnings.append(f"Circuit breaker open for '{tool.name}', skipping")
                tools_tried.append(tool.name)
                continue

            # Check if we have an executor for this tool
            executor = self.executor_registry.get(tool.name)
            if not executor:
                # Try the generic executor based on tool type
                executor = self._get_generic_executor(tool)
                if not executor:
                    warnings.append(f"No executor registered for '{tool.name}'")
                    tools_tried.append(tool.name)
                    continue

            tools_tried.append(tool.name)
            tool_start = time.time()

            try:
                logger.info("Running tool '%s' for %s (query='%s')",
                           tool.name, target_type.value, query[:50])

                data = executor(tool, query, max_results, **kwargs)
                tool_elapsed = time.time() - tool_start

                if data is not None and len(data) > 0:
                    # Success
                    with self._lock:
                        tool.record_success(tool_elapsed)
                        self._close_circuit(tool.name)

                    logger.info("Tool '%s' returned %d results in %.2fs",
                               tool.name, len(data), tool_elapsed)

                    return ToolExecutionResult(
                        success=True,
                        tool_name=tool.name,
                        target_type=target_type.value,
                        data=data,
                        elapsed=time.time() - start,
                        fallback_used=len(tools_tried) > 1,
                        tools_tried=tools_tried,
                        warnings=warnings,
                    )
                else:
                    # Empty result — not necessarily an error, try next
                    warnings.append(f"Tool '{tool.name}' returned empty results")
                    last_error = f"Tool '{tool.name}' returned no data"

            except Exception as e:
                tool_elapsed = time.time() - tool_start
                error_msg = f"{type(e).__name__}: {str(e)}"
                logger.warning("Tool '%s' failed: %s (%.2fs)",
                              tool.name, error_msg, tool_elapsed)

                with self._lock:
                    tool.record_failure(error_msg)
                    if tool.consecutive_errors >= self._circuit_breaker_threshold:
                        self._open_circuit(tool.name)
                        warnings.append(f"Circuit breaker opened for '{tool.name}' after {tool.consecutive_errors} failures")

                last_error = error_msg

        # All tools failed
        return ToolExecutionResult(
            success=False,
            tool_name=tools_tried[-1] if tools_tried else "none",
            target_type=target_type.value,
            error=f"All tools failed for {target_type.value}. Last error: {last_error}",
            elapsed=time.time() - start,
            fallback_used=len(tools_tried) > 1,
            tools_tried=tools_tried,
            warnings=warnings,
        )

    def run_with_specific_tool(
        self,
        tool_name: str,
        query: str = "",
        max_results: int = 50,
        **kwargs,
    ) -> ToolExecutionResult:
        """Run a specific tool by name, no fallback."""
        tool = self.registry.get_tool(tool_name)
        if not tool:
            return ToolExecutionResult(
                success=False,
                tool_name=tool_name,
                target_type="unknown",
                error=f"Tool '{tool_name}' not found",
            )

        return self.run(
            tool.target_type,
            query=query,
            max_results=max_results,
            preferred_tool=tool_name,
            **kwargs,
        )

    def run_multi_target(
        self,
        targets: List[TargetType],
        query: str = "",
        max_results: int = 50,
        **kwargs,
    ) -> Dict[str, ToolExecutionResult]:
        """Run tools across multiple target types."""
        results = {}
        for target in targets:
            results[target.value] = self.run(target, query, max_results, **kwargs)
        return results

    # ------------------------------------------------------------------
    # Circuit breaker
    # ------------------------------------------------------------------

    def _is_circuit_open(self, tool_name: str) -> bool:
        if tool_name not in self._circuit_open_since:
            return False
        elapsed = time.time() - self._circuit_open_since[tool_name]
        if elapsed > self._circuit_breaker_timeout:
            # Half-open: allow one retry
            del self._circuit_open_since[tool_name]
            return False
        return True

    def _open_circuit(self, tool_name: str):
        self._circuit_open_since[tool_name] = time.time()
        logger.warning("Circuit breaker OPENED for '%s'", tool_name)

    def _close_circuit(self, tool_name: str):
        if tool_name in self._circuit_open_since:
            del self._circuit_open_since[tool_name]
            logger.info("Circuit breaker CLOSED for '%s'", tool_name)

    # ------------------------------------------------------------------
    # Generic executors
    # ------------------------------------------------------------------

    def _get_generic_executor(self, tool: ToolDefinition) -> Optional[Callable]:
        """Return a generic executor based on tool type when no specific one is registered."""
        if tool.tool_type == ToolType.REST_API and tool.api_base_url:
            return self._generic_rest_executor
        return None

    def _generic_rest_executor(
        self,
        tool: ToolDefinition,
        query: str,
        max_results: int,
        **kwargs,
    ) -> List[dict]:
        """Generic REST API executor for tools with api_base_url."""
        from core.http_client import HttpClient

        with HttpClient() as client:
            # Try common search endpoint patterns
            endpoints = [
                f"{tool.api_base_url}/search",
                f"{tool.api_base_url}/api/search",
                f"{tool.api_base_url}/api/v1/search",
                f"{tool.api_base_url}/query",
            ]

            for endpoint in endpoints:
                try:
                    data = client.get_json(
                        endpoint,
                        params={"q": query, "limit": max_results},
                    )
                    if data:
                        if isinstance(data, list):
                            return data[:max_results]
                        elif isinstance(data, dict):
                            # Try to find results in common response fields
                            for key in ("results", "items", "data", "records", "hits"):
                                if key in data and isinstance(data[key], list):
                                    return data[key][:max_results]
                            return [data]
                except Exception:
                    continue

            return []

    # ------------------------------------------------------------------
    # Built-in executor registration
    # ------------------------------------------------------------------

    def _register_builtin_executors(self):
        """Register executors for tools we have native implementations for."""
        self.executor_registry.register("github-api", self._exec_github_api)
        self.executor_registry.register("cve-search", self._exec_cve_search)
        self.executor_registry.register("nvdlib", self._exec_nvd)
        self.executor_registry.register("reddit-json-api", self._exec_reddit_json)
        self.executor_registry.register("reddit-html-scraper", self._exec_reddit_html)
        self.executor_registry.register("praw", self._exec_praw)
        self.executor_registry.register("pastebin-scrape-api", self._exec_pastebin)
        self.executor_registry.register("psbdmp-api", self._exec_psbdmp)
        self.executor_registry.register("ahmia", self._exec_ahmia)
        self.executor_registry.register("onionsearch", self._exec_onionsearch)
        self.executor_registry.register("shodan-cli", self._exec_shodan)
        self.executor_registry.register("censys", self._exec_censys)
        self.executor_registry.register("osv-api", self._exec_osv)
        self.executor_registry.register("malwarebazaar", self._exec_malwarebazaar)
        self.executor_registry.register("abuse-ipdb", self._exec_abuseipdb)
        self.executor_registry.register("virustotal-api", self._exec_virustotal)
        self.executor_registry.register("otx-alienvault", self._exec_otx)
        self.executor_registry.register("emailrep", self._exec_emailrep)
        self.executor_registry.register("sherlock", self._exec_sherlock)
        self.executor_registry.register("holehe", self._exec_holehe)
        self.executor_registry.register("dnstwist", self._exec_dnstwist)
        self.executor_registry.register("subfinder", self._exec_subfinder)
        self.executor_registry.register("spiderfoot", self._exec_spiderfoot)
        self.executor_registry.register("theharvester", self._exec_theharvester)
        self.executor_registry.register("tor-requests", self._exec_tor_requests)
        self.executor_registry.register("arctic-shift", self._exec_arctic_shift)
        self.executor_registry.register("intelligence-x", self._exec_intelx)
        self.executor_registry.register("vulners-api", self._exec_vulners)
        self.executor_registry.register("exploitdb", self._exec_exploitdb)
        self.executor_registry.register("pastehunter", self._exec_pastehunter)
        self.executor_registry.register("telethon", self._exec_telethon)
        self.executor_registry.register("telegram-bot-api", self._exec_telegram_bot)
        self.executor_registry.register("nmap-python", self._exec_nmap)
        self.executor_registry.register("misp", self._exec_misp)
        self.executor_registry.register("yara-python", self._exec_yara)
        self.executor_registry.register("gitleaks", self._exec_gitleaks)
        self.executor_registry.register("trufflehog", self._exec_trufflehog)

    # ------------------------------------------------------------------
    # Built-in executors — GitHub
    # ------------------------------------------------------------------

    def _exec_github_api(self, tool, query, max_results, **kw) -> List[dict]:
        from collectors.github_collector import GitHubCollector
        collector = GitHubCollector(use_tool_registry=False)
        return collector.collect(
            query or "api_key filename:.env",
            max_results,
            use_tool_registry=False,
            scan_signatures=False,
        )
    def _exec_gitleaks(self, tool, query, max_results, **kw) -> List[dict]:
        import subprocess, json, tempfile, os
        repo_url = kw.get("repo_url", query)
        if not repo_url:
            raise ValueError("gitleaks requires a repo URL or path")
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            report_path = f.name
        try:
            cmd = ["gitleaks", "detect", "--source", repo_url,
                   "--report-format", "json", "--report-path", report_path,
                   "--no-banner"]
            subprocess.run(cmd, capture_output=True, timeout=120)
            if os.path.exists(report_path):
                with open(report_path) as f:
                    findings = json.load(f)
                return [
                    {
                        "source": "gitleaks",
                        "type": "leak",
                        "title": f"Secret found: {item.get('RuleID', 'unknown')} in {item.get('File', '')}",
                        "content": item.get("Match", "")[:500],
                        "url": repo_url,
                        "metadata": {
                            "rule_id": item.get("RuleID"),
                            "file": item.get("File"),
                            "line": item.get("StartLine"),
                            "commit": item.get("Commit"),
                            "author": item.get("Author"),
                            "date": item.get("Date"),
                            "entropy": item.get("Entropy"),
                        }
                    }
                    for item in (findings or [])[:max_results]
                ]
            return []
        finally:
            if os.path.exists(report_path):
                os.unlink(report_path)

    def _exec_trufflehog(self, tool, query, max_results, **kw) -> List[dict]:
        import subprocess, json
        repo_url = kw.get("repo_url", query)
        if not repo_url:
            raise ValueError("trufflehog requires a repo URL or path")
        cmd = ["trufflehog", "git", repo_url, "--json", "--no-update"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        findings = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            try:
                item = json.loads(line)
                findings.append({
                    "source": "trufflehog",
                    "type": "leak",
                    "title": f"Verified secret: {item.get('DetectorName', 'unknown')}",
                    "content": item.get("Raw", "")[:500],
                    "url": repo_url,
                    "metadata": {
                        "detector": item.get("DetectorName"),
                        "verified": item.get("Verified"),
                        "source_type": item.get("SourceType"),
                        "file": item.get("SourceMetadata", {}).get("file"),
                    }
                })
            except json.JSONDecodeError:
                continue
        return findings[:max_results]

    # ------------------------------------------------------------------
    # Built-in executors — CVE / Vulnerability
    # ------------------------------------------------------------------

    def _exec_cve_search(self, tool, query, max_results, **kw) -> List[dict]:
        from collectors.cve_collector import CVECollector
        collector = CVECollector(use_tool_registry=False)
        return collector.collect(
            query,
            max_results,
            use_tool_registry=False,
            scan_signatures=False,
        )
    def _exec_nvd(self, tool, query, max_results, **kw) -> List[dict]:
        from core.http_client import HttpClient
        with HttpClient() as client:
            params = {"resultsPerPage": min(max_results, 50)}
            if query:
                params["keywordSearch"] = query
            data = client.get_json(
                "https://services.nvd.nist.gov/rest/json/cves/2.0",
                params=params
            )
            if not data or "vulnerabilities" not in data:
                return []
            results = []
            for item in data["vulnerabilities"][:max_results]:
                cve = item.get("cve", {})
                desc = ""
                for d in cve.get("descriptions", []):
                    if d.get("lang") == "en":
                        desc = d.get("value", "")
                        break
                cvss = 0.0
                metrics = cve.get("metrics", {})
                for version in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
                    if version in metrics and metrics[version]:
                        cvss = metrics[version][0].get("cvssData", {}).get("baseScore", 0.0)
                        break
                results.append({
                    "source": "nvd",
                    "type": "vuln",
                    "title": cve.get("id", ""),
                    "content": desc,
                    "url": f"https://nvd.nist.gov/vuln/detail/{cve.get('id', '')}",
                    "metadata": {
                        "cve_id": cve.get("id"),
                        "cvss_score": cvss,
                        "published": cve.get("published"),
                        "modified": cve.get("lastModified"),
                    }
                })
            return results

    def _exec_osv(self, tool, query, max_results, **kw) -> List[dict]:
        from core.http_client import HttpClient
        with HttpClient() as client:
            payload = {"query": query} if query else {}
            # OSV uses POST for queries
            import requests
            resp = requests.post(
                "https://api.osv.dev/v1/query",
                json=payload,
                timeout=30,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            results = []
            for vuln in data.get("vulns", [])[:max_results]:
                results.append({
                    "source": "osv",
                    "type": "vuln",
                    "title": vuln.get("summary", vuln.get("id", "")),
                    "content": vuln.get("details", ""),
                    "url": f"https://osv.dev/vulnerability/{vuln.get('id', '')}",
                    "metadata": {
                        "id": vuln.get("id"),
                        "aliases": vuln.get("aliases", []),
                        "severity": vuln.get("severity", []),
                        "affected": [a.get("package", {}).get("name") for a in vuln.get("affected", [])],
                    }
                })
            return results

    def _exec_vulners(self, tool, query, max_results, **kw) -> List[dict]:
        import os
        api_key = os.environ.get("VULNERS_API_KEY")
        if not api_key:
            raise ValueError("VULNERS_API_KEY not set")
        try:
            import vulners
            vapi = vulners.VulnersApi(api_key=api_key)
            results_raw = vapi.search(query or "CVE", limit=max_results)
            results = []
            for item in results_raw:
                results.append({
                    "source": "vulners",
                    "type": "vuln",
                    "title": item.get("title", ""),
                    "content": item.get("description", ""),
                    "url": item.get("href", ""),
                    "metadata": {
                        "id": item.get("id"),
                        "type": item.get("type"),
                        "cvss_score": item.get("cvss", {}).get("score"),
                    }
                })
            return results
        except ImportError:
            raise ValueError("vulners package not installed")

    def _exec_exploitdb(self, tool, query, max_results, **kw) -> List[dict]:
        import subprocess, json
        cmd = ["searchsploit", "--json", query or "remote code execution"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return []
        try:
            data = json.loads(result.stdout)
            results = []
            for item in data.get("RESULTS_EXPLOIT", [])[:max_results]:
                results.append({
                    "source": "exploitdb",
                    "type": "vuln",
                    "title": item.get("Title", ""),
                    "content": item.get("Description", item.get("Title", "")),
                    "url": f"https://www.exploit-db.com/exploits/{item.get('EDB-ID', '')}",
                    "metadata": {
                        "edb_id": item.get("EDB-ID"),
                        "date": item.get("Date Published"),
                        "platform": item.get("Platform"),
                        "type": item.get("Type"),
                        "author": item.get("Author"),
                    }
                })
            return results
        except json.JSONDecodeError:
            return []

    # ------------------------------------------------------------------
    # Built-in executors — Reddit
    # ------------------------------------------------------------------

    def _exec_reddit_json(self, tool, query, max_results, **kw) -> List[dict]:
        from collectors.reddit_collector import RedditCollector
        collector = RedditCollector(use_tool_registry=False)
        return collector.collect(
            query or "data breach vulnerability",
            max_results,
            use_tool_registry=False,
            scan_signatures=False,
        )
    def _exec_reddit_html(self, tool, query, max_results, **kw) -> List[dict]:
        from collectors.reddit_collector import RedditCollector
        collector = RedditCollector(use_tool_registry=False)
        return collector._collect_html(
            query or "security",
            max_results,
            subreddits=collector.subreddits[:3],
        )[:max_results]
    def _exec_praw(self, tool, query, max_results, **kw) -> List[dict]:
        import os
        client_id = os.environ.get("REDDIT_CLIENT_ID")
        client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise ValueError("REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET required")
        try:
            import praw
            reddit = praw.Reddit(
                client_id=client_id,
                client_secret=client_secret,
                user_agent="HYDRA-INTEL/1.0"
            )
            results = []
            subreddits = ["netsec", "cybersecurity", "hacking", "InfoSecNews"]
            for sub_name in subreddits:
                sub = reddit.subreddit(sub_name)
                for post in sub.search(query or "security", limit=max_results // len(subreddits)):
                    results.append({
                        "source": "reddit",
                        "type": "mention",
                        "title": post.title,
                        "content": (post.selftext or "")[:2000],
                        "url": f"https://reddit.com{post.permalink}",
                        "metadata": {
                            "subreddit": sub_name,
                            "author": str(post.author),
                            "score": post.score,
                            "num_comments": post.num_comments,
                            "created_utc": post.created_utc,
                        }
                    })
            return results[:max_results]
        except ImportError:
            raise ValueError("praw package not installed")

    def _exec_arctic_shift(self, tool, query, max_results, **kw) -> List[dict]:
        from core.http_client import HttpClient
        with HttpClient() as client:
            data = client.get_json(
                "https://arctic-shift.photon-reddit.com/api/posts/search",
                params={
                    "q": query or "security vulnerability",
                    "limit": min(max_results, 100),
                    "subreddit": "netsec,cybersecurity,hacking",
                }
            )
            if not data or "data" not in data:
                return []
            results = []
            for post in data["data"][:max_results]:
                results.append({
                    "source": "reddit",
                    "type": "mention",
                    "title": post.get("title", ""),
                    "content": post.get("selftext", "")[:2000],
                    "url": f"https://reddit.com{post.get('permalink', '')}",
                    "metadata": {
                        "subreddit": post.get("subreddit"),
                        "author": post.get("author"),
                        "score": post.get("score"),
                        "created_utc": post.get("created_utc"),
                    }
                })
            return results

    # ------------------------------------------------------------------
    # Built-in executors — Paste / Leaks
    # ------------------------------------------------------------------

    def _exec_pastebin(self, tool, query, max_results, **kw) -> List[dict]:
        from collectors.pastebin_collector import PastebinCollector
        collector = PastebinCollector(use_tool_registry=False)
        return collector.collect(
            query or "password",
            max_results,
            use_tool_registry=False,
            scan_signatures=False,
        )
    def _exec_psbdmp(self, tool, query, max_results, **kw) -> List[dict]:
        from core.http_client import HttpClient
        with HttpClient() as client:
            data = client.get_json(
                f"https://psbdmp.ws/api/v3/search/{query or 'password'}",
            )
            if not data or not isinstance(data, list):
                return []
            results = []
            for item in data[:max_results]:
                results.append({
                    "source": "psbdmp",
                    "type": "leak",
                    "title": f"Paste dump: {item.get('id', 'unknown')}",
                    "content": item.get("text", "")[:2000],
                    "url": f"https://pastebin.com/{item.get('id', '')}",
                    "metadata": {
                        "paste_id": item.get("id"),
                        "tags": item.get("tags", []),
                    }
                })
            return results

    def _exec_pastehunter(self, tool, query, max_results, **kw) -> List[dict]:
        # PasteHunter is typically a daemon — we invoke its search capability
        try:
            from pastehunter import pastehunter
            # Fallback: use pastebin scrape API directly
            return self._exec_pastebin(tool, query, max_results, **kw)
        except ImportError:
            return self._exec_pastebin(tool, query, max_results, **kw)

    def _exec_intelx(self, tool, query, max_results, **kw) -> List[dict]:
        import os
        api_key = os.environ.get("INTELX_API_KEY")
        if not api_key:
            raise ValueError("INTELX_API_KEY not set")
        import requests
        headers = {"x-key": api_key}
        # Start search
        resp = requests.post(
            "https://2.intelx.io/intelligent/search",
            json={"term": query, "maxresults": max_results, "media": 0},
            headers=headers, timeout=30,
        )
        if resp.status_code != 200:
            raise ValueError(f"IntelX search failed: {resp.status_code}")
        search_data = resp.json()
        search_id = search_data.get("id")
        if not search_id:
            return []
        # Fetch results
        import time as _time
        _time.sleep(2)
        resp = requests.get(
            f"https://2.intelx.io/intelligent/search/result?id={search_id}",
            headers=headers, timeout=30,
        )
        if resp.status_code != 200:
            return []
        results_data = resp.json()
        results = []
        for item in results_data.get("records", [])[:max_results]:
            results.append({
                "source": "intelx",
                "type": "leak",
                "title": item.get("name", ""),
                "content": item.get("description", "")[:2000],
                "url": item.get("storageid", ""),
                "metadata": {
                    "media_type": item.get("media"),
                    "bucket": item.get("bucket"),
                    "date": item.get("date"),
                    "size": item.get("size"),
                }
            })
        return results

    # ------------------------------------------------------------------
    # Built-in executors — Dark Web
    # ------------------------------------------------------------------

    def _exec_ahmia(self, tool, query, max_results, **kw) -> List[dict]:
        from core.http_client import HttpClient
        with HttpClient() as client:
            data = client.get_json(
                "https://ahmia.fi/search/",
                params={"q": query or "marketplace"},
            )
            # Ahmia returns HTML, parse it
            if not data:
                # Try HTML scraping
                resp = client.get("https://ahmia.fi/search/", params={"q": query or "marketplace"})
                if not resp or resp.status_code != 200:
                    return []
                from core.parser import parse_html, extract_links
                soup = parse_html(resp.text)
                results = []
                for link in soup.select("li.result h4 a")[:max_results]:
                    results.append({
                        "source": "ahmia",
                        "type": "alert",
                        "title": link.get_text(strip=True),
                        "content": "",
                        "url": link.get("href", ""),
                        "metadata": {"search_engine": "ahmia"}
                    })
                return results
            return []

    def _exec_onionsearch(self, tool, query, max_results, **kw) -> List[dict]:
        import subprocess, json
        try:
            cmd = ["onionsearch", "--query", query or "marketplace",
                   "--limit", str(max_results), "--output", "json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.stdout:
                data = json.loads(result.stdout)
                return [
                    {
                        "source": "onionsearch",
                        "type": "alert",
                        "title": item.get("title", ""),
                        "content": item.get("description", ""),
                        "url": item.get("link", ""),
                        "metadata": {"engine": item.get("engine", "")}
                    }
                    for item in (data if isinstance(data, list) else [])[:max_results]
                ]
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            pass
        return []

    def _exec_tor_requests(self, tool, query, max_results, **kw) -> List[dict]:
        """Access .onion sites through Tor SOCKS proxy."""
        try:
            import requests
            session = requests.Session()
            session.proxies = {
                "http": "socks5h://127.0.0.1:9050",
                "https": "socks5h://127.0.0.1:9050",
            }
            # Try to reach the target URL
            target_url = kw.get("url", query)
            if not target_url:
                raise ValueError("tor-requests requires a URL")
            resp = session.get(target_url, timeout=30)
            from core.parser import parse_html
            soup = parse_html(resp.text)
            title = soup.title.string if soup.title else target_url
            return [{
                "source": "tor",
                "type": "alert",
                "title": title,
                "content": soup.get_text()[:5000],
                "url": target_url,
                "metadata": {"status_code": resp.status_code}
            }]
        except Exception as e:
            raise ValueError(f"Tor request failed: {e}")

    # ------------------------------------------------------------------
    # Built-in executors — Infrastructure
    # ------------------------------------------------------------------

    def _exec_shodan(self, tool, query, max_results, **kw) -> List[dict]:
        import os
        api_key = os.environ.get("SHODAN_API_KEY")
        if not api_key:
            raise ValueError("SHODAN_API_KEY not set")
        try:
            import shodan
            api = shodan.Shodan(api_key)
            data = api.search(query or "apache", page=1)
            results = []
            for match in data.get("matches", [])[:max_results]:
                results.append({
                    "source": "shodan",
                    "type": "alert",
                    "title": f"{match.get('ip_str', '')}:{match.get('port', '')} — {match.get('product', 'unknown')}",
                    "content": match.get("data", "")[:2000],
                    "url": f"https://www.shodan.io/host/{match.get('ip_str', '')}",
                    "metadata": {
                        "ip": match.get("ip_str"),
                        "port": match.get("port"),
                        "org": match.get("org"),
                        "os": match.get("os"),
                        "product": match.get("product"),
                        "version": match.get("version"),
                        "country": match.get("location", {}).get("country_name"),
                        "vulns": match.get("vulns", []),
                    }
                })
            return results
        except ImportError:
            raise ValueError("shodan package not installed")

    def _exec_censys(self, tool, query, max_results, **kw) -> List[dict]:
        import os
        api_id = os.environ.get("CENSYS_API_ID")
        api_secret = os.environ.get("CENSYS_API_SECRET")
        if not api_id or not api_secret:
            raise ValueError("CENSYS_API_ID and CENSYS_API_SECRET required")
        try:
            from censys.search import CensysHosts
            h = CensysHosts(api_id=api_id, api_secret=api_secret)
            results = []
            for host in h.search(query or "services.http.response.html_title: admin", per_page=max_results):
                results.append({
                    "source": "censys",
                    "type": "alert",
                    "title": f"Host: {host.get('ip', '')}",
                    "content": str(host.get("services", []))[:2000],
                    "url": f"https://search.censys.io/hosts/{host.get('ip', '')}",
                    "metadata": {
                        "ip": host.get("ip"),
                        "services": host.get("services"),
                        "location": host.get("location"),
                        "autonomous_system": host.get("autonomous_system"),
                    }
                })
            return results[:max_results]
        except ImportError:
            raise ValueError("censys package not installed")

    def _exec_nmap(self, tool, query, max_results, **kw) -> List[dict]:
        try:
            import nmap
            scanner = nmap.PortScanner()
            target = kw.get("target", query)
            if not target:
                raise ValueError("nmap requires a target IP/host")
            ports = kw.get("ports", "1-1000")
            scanner.scan(target, ports, arguments="-sV --open")
            results = []
            for host in scanner.all_hosts():
                for proto in scanner[host].all_protocols():
                    for port in scanner[host][proto]:
                        info = scanner[host][proto][port]
                        results.append({
                            "source": "nmap",
                            "type": "alert",
                            "title": f"{host}:{port} — {info.get('product', '')} {info.get('version', '')}",
                            "content": f"State: {info.get('state')} | Service: {info.get('name')} | Product: {info.get('product')} {info.get('version')}",
                            "url": f"https://www.shodan.io/host/{host}",
                            "metadata": {
                                "host": host, "port": port, "protocol": proto,
                                "state": info.get("state"), "service": info.get("name"),
                                "product": info.get("product"), "version": info.get("version"),
                            }
                        })
            return results[:max_results]
        except ImportError:
            raise ValueError("python-nmap not installed")

    # ------------------------------------------------------------------
    # Built-in executors — Threat Intel
    # ------------------------------------------------------------------

    def _exec_misp(self, tool, query, max_results, **kw) -> List[dict]:
        import os
        misp_url = os.environ.get("MISP_URL")
        misp_key = os.environ.get("MISP_KEY")
        if not misp_url or not misp_key:
            raise ValueError("MISP_URL and MISP_KEY required")
        try:
            from pymisp import PyMISP
            misp = PyMISP(misp_url, misp_key, ssl=False)
            events = misp.search(value=query, limit=max_results, pythonify=True)
            results = []
            for event in events:
                results.append({
                    "source": "misp",
                    "type": "alert",
                    "title": event.info,
                    "content": str(event.Attribute)[:2000] if hasattr(event, "Attribute") else "",
                    "url": f"{misp_url}/events/view/{event.id}",
                    "metadata": {
                        "event_id": event.id,
                        "threat_level": event.threat_level_id,
                        "analysis": event.analysis,
                        "date": str(event.date),
                        "org": event.Orgc.name if hasattr(event, "Orgc") else "",
                    }
                })
            return results
        except ImportError:
            raise ValueError("pymisp not installed")

    def _exec_otx(self, tool, query, max_results, **kw) -> List[dict]:
        import os
        api_key = os.environ.get("OTX_API_KEY")
        if not api_key:
            raise ValueError("OTX_API_KEY not set")
        try:
            from OTXv2 import OTXv2
            otx = OTXv2(api_key)
            pulses = otx.search_pulses(query or "malware")
            results = []
            for pulse in pulses.get("results", [])[:max_results]:
                results.append({
                    "source": "otx",
                    "type": "alert",
                    "title": pulse.get("name", ""),
                    "content": pulse.get("description", "")[:2000],
                    "url": f"https://otx.alienvault.com/pulse/{pulse.get('id', '')}",
                    "metadata": {
                        "pulse_id": pulse.get("id"),
                        "author": pulse.get("author_name"),
                        "tags": pulse.get("tags", []),
                        "tlp": pulse.get("tlp"),
                        "adversary": pulse.get("adversary"),
                        "indicators": len(pulse.get("indicators", [])),
                    }
                })
            return results
        except ImportError:
            raise ValueError("OTXv2 not installed")

    def _exec_abuseipdb(self, tool, query, max_results, **kw) -> List[dict]:
        import os, requests
        api_key = os.environ.get("ABUSEIPDB_API_KEY")
        if not api_key:
            raise ValueError("ABUSEIPDB_API_KEY not set")
        headers = {"Key": api_key, "Accept": "application/json"}
        resp = requests.get(
            "https://api.abuseipdb.com/api/v2/check",
            params={"ipAddress": query, "maxAgeInDays": 90},
            headers=headers, timeout=30,
        )
        if resp.status_code != 200:
            raise ValueError(f"AbuseIPDB API error: {resp.status_code}")
        data = resp.json().get("data", {})
        return [{
            "source": "abuseipdb",
            "type": "alert",
            "title": f"IP Report: {data.get('ipAddress', query)}",
            "content": f"Abuse confidence: {data.get('abuseConfidenceScore')}% | Reports: {data.get('totalReports')} | Country: {data.get('countryCode')}",
            "url": f"https://www.abuseipdb.com/check/{query}",
            "metadata": {
                "ip": data.get("ipAddress"),
                "abuse_score": data.get("abuseConfidenceScore"),
                "total_reports": data.get("totalReports"),
                "country": data.get("countryCode"),
                "isp": data.get("isp"),
                "domain": data.get("domain"),
                "is_tor": data.get("isTor"),
                "is_public": data.get("isPublic"),
            }
        }]

    def _exec_virustotal(self, tool, query, max_results, **kw) -> List[dict]:
        import os
        api_key = os.environ.get("VIRUSTOTAL_API_KEY")
        if not api_key:
            raise ValueError("VIRUSTOTAL_API_KEY not set")
        try:
            import vt
            client = vt.Client(api_key)
            try:
                # Determine query type: hash, domain, ip, or url
                results = []
                if len(query) in (32, 40, 64) and all(c in "0123456789abcdefABCDEF" for c in query):
                    # Hash lookup
                    f = client.get_object(f"/files/{query}")
                    results.append({
                        "source": "virustotal",
                        "type": "alert",
                        "title": f"File: {f.sha256}",
                        "content": f"Detection: {f.last_analysis_stats}",
                        "url": f"https://www.virustotal.com/gui/file/{f.sha256}",
                        "metadata": {
                            "sha256": f.sha256,
                            "detection_stats": f.last_analysis_stats,
                            "type_tag": getattr(f, "type_tag", ""),
                            "reputation": getattr(f, "reputation", 0),
                        }
                    })
                else:
                    # Search
                    it = client.iterator(f"/search?query={query}", limit=max_results)
                    for obj in it:
                        results.append({
                            "source": "virustotal",
                            "type": "alert",
                            "title": f"VT: {getattr(obj, 'meaningful_name', str(obj.id))}",
                            "content": str(getattr(obj, "last_analysis_stats", ""))[:2000],
                            "url": f"https://www.virustotal.com/gui/file/{obj.id}",
                            "metadata": {"id": obj.id}
                        })
                return results[:max_results]
            finally:
                client.close()
        except ImportError:
            raise ValueError("vt-py not installed")

    def _exec_malwarebazaar(self, tool, query, max_results, **kw) -> List[dict]:
        import requests
        resp = requests.post(
            "https://mb-api.abuse.ch/api/v1/",
            data={"query": "get_recent", "selector": "100"},
            timeout=30,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        results = []
        for item in data.get("data", [])[:max_results]:
            sig = item.get("signature") or "unknown"
            results.append({
                "source": "malwarebazaar",
                "type": "alert",
                "title": f"Malware: {sig} — {item.get('file_type', '')}",
                "content": f"SHA256: {item.get('sha256_hash')} | Tags: {', '.join(item.get('tags', []) or [])}",
                "url": f"https://bazaar.abuse.ch/sample/{item.get('sha256_hash', '')}",
                "metadata": {
                    "sha256": item.get("sha256_hash"),
                    "md5": item.get("md5_hash"),
                    "signature": sig,
                    "file_type": item.get("file_type"),
                    "file_size": item.get("file_size"),
                    "tags": item.get("tags"),
                    "first_seen": item.get("first_seen"),
                    "reporter": item.get("reporter"),
                }
            })
        return results

    def _exec_yara(self, tool, query, max_results, **kw) -> List[dict]:
        """Run YARA rules against provided data/files."""
        try:
            import yara
            rule_source = kw.get("yara_rules")
            target_data = kw.get("data", query)
            if not rule_source:
                raise ValueError("yara requires 'yara_rules' kwarg")
            rules = yara.compile(source=rule_source)
            matches = rules.match(data=target_data.encode() if isinstance(target_data, str) else target_data)
            return [
                {
                    "source": "yara",
                    "type": "alert",
                    "title": f"YARA match: {m.rule}",
                    "content": f"Tags: {m.tags} | Strings: {[str(s) for s in m.strings[:5]]}",
                    "url": "",
                    "metadata": {
                        "rule": m.rule,
                        "tags": m.tags,
                        "namespace": m.namespace,
                    }
                }
                for m in matches[:max_results]
            ]
        except ImportError:
            raise ValueError("yara-python not installed")

    # ------------------------------------------------------------------
    # Built-in executors — Social / Email / DNS
    # ------------------------------------------------------------------

    def _exec_sherlock(self, tool, query, max_results, **kw) -> List[dict]:
        import subprocess, json
        try:
            cmd = ["sherlock", query, "--output", "/dev/null", "--print-found", "--json", "-"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            results = []
            try:
                data = json.loads(result.stdout)
                for site, info in data.items():
                    if info.get("status") == "Claimed":
                        results.append({
                            "source": "sherlock",
                            "type": "mention",
                            "title": f"@{query} on {site}",
                            "content": f"Profile found for '{query}' on {site}",
                            "url": info.get("url_user", ""),
                            "metadata": {"site": site, "status": "found"}
                        })
            except json.JSONDecodeError:
                # Parse line output
                for line in result.stdout.strip().split("\n"):
                    if "[+]" in line:
                        results.append({
                            "source": "sherlock",
                            "type": "mention",
                            "title": f"Username match: {line.strip()}",
                            "content": line.strip(),
                            "url": "",
                            "metadata": {}
                        })
            return results[:max_results]
        except FileNotFoundError:
            raise ValueError("sherlock not installed")

    def _exec_holehe(self, tool, query, max_results, **kw) -> List[dict]:
        try:
            import subprocess, json
            cmd = ["holehe", query, "--only-used", "--no-color"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            results = []
            for line in result.stdout.strip().split("\n"):
                if "[+]" in line:
                    parts = line.strip().split()
                    site = parts[1] if len(parts) > 1 else "unknown"
                    results.append({
                        "source": "holehe",
                        "type": "mention",
                        "title": f"Email registered: {query} on {site}",
                        "content": line.strip(),
                        "url": "",
                        "metadata": {"site": site, "email": query}
                    })
            return results[:max_results]
        except FileNotFoundError:
            raise ValueError("holehe not installed")

    def _exec_emailrep(self, tool, query, max_results, **kw) -> List[dict]:
        import requests
        resp = requests.get(
            f"https://emailrep.io/{query}",
            headers={"User-Agent": "HYDRA-INTEL/1.0"},
            timeout=30,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return [{
            "source": "emailrep",
            "type": "mention",
            "title": f"Email reputation: {query}",
            "content": f"Reputation: {data.get('reputation')} | Suspicious: {data.get('suspicious')} | Breaches: {data.get('references', 0)}",
            "url": f"https://emailrep.io/{query}",
            "metadata": {
                "email": query,
                "reputation": data.get("reputation"),
                "suspicious": data.get("suspicious"),
                "references": data.get("references"),
                "details": data.get("details", {}),
            }
        }]

    def _exec_dnstwist(self, tool, query, max_results, **kw) -> List[dict]:
        try:
            import subprocess, json
            cmd = ["dnstwist", "--format", "json", query]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            data = json.loads(result.stdout)
            results = []
            for item in data[:max_results]:
                if item.get("dns_a") or item.get("dns_aaaa"):
                    results.append({
                        "source": "dnstwist",
                        "type": "alert",
                        "title": f"Typosquat: {item.get('domain-name', '')}",
                        "content": f"Fuzzer: {item.get('fuzzer')} | A: {item.get('dns_a', '')} | MX: {item.get('dns_mx', '')}",
                        "url": f"http://{item.get('domain-name', '')}",
                        "metadata": {
                            "domain": item.get("domain-name"),
                            "fuzzer": item.get("fuzzer"),
                            "dns_a": item.get("dns_a"),
                            "dns_mx": item.get("dns_mx"),
                            "geoip": item.get("geoip"),
                        }
                    })
            return results
        except (ImportError, FileNotFoundError):
            raise ValueError("dnstwist not installed")

    def _exec_subfinder(self, tool, query, max_results, **kw) -> List[dict]:
        import subprocess
        try:
            cmd = ["subfinder", "-d", query, "-silent"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            subdomains = [s.strip() for s in result.stdout.strip().split("\n") if s.strip()]
            return [
                {
                    "source": "subfinder",
                    "type": "alert",
                    "title": f"Subdomain: {sub}",
                    "content": f"Discovered subdomain for {query}: {sub}",
                    "url": f"https://{sub}",
                    "metadata": {"parent_domain": query, "subdomain": sub}
                }
                for sub in subdomains[:max_results]
            ]
        except FileNotFoundError:
            raise ValueError("subfinder not installed")

    def _exec_spiderfoot(self, tool, query, max_results, **kw) -> List[dict]:
        try:
            import subprocess, json
            cmd = ["spiderfoot", "-s", query, "-m", "sfp_dnsresolve,sfp_portscan_basic",
                   "-o", "json", "-q"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            data = json.loads(result.stdout) if result.stdout else []
            results = []
            for item in data[:max_results]:
                results.append({
                    "source": "spiderfoot",
                    "type": "alert",
                    "title": f"SF: {item.get('type', '')} — {item.get('data', '')[:80]}",
                    "content": item.get("data", "")[:2000],
                    "url": "",
                    "metadata": {
                        "module": item.get("module"),
                        "type": item.get("type"),
                        "source": item.get("source"),
                    }
                })
            return results
        except (FileNotFoundError, json.JSONDecodeError):
            raise ValueError("spiderfoot not installed or failed")

    def _exec_theharvester(self, tool, query, max_results, **kw) -> List[dict]:
        import subprocess
        try:
            cmd = ["theHarvester", "-d", query, "-b", "all", "-l", str(max_results)]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            results = []
            section = None
            for line in result.stdout.split("\n"):
                line = line.strip()
                if "Emails found" in line:
                    section = "email"
                elif "Hosts found" in line:
                    section = "host"
                elif line and section:
                    results.append({
                        "source": "theharvester",
                        "type": "mention",
                        "title": f"{'Email' if section == 'email' else 'Host'}: {line}",
                        "content": line,
                        "url": "",
                        "metadata": {"type": section, "domain": query}
                    })
            return results[:max_results]
        except FileNotFoundError:
            raise ValueError("theHarvester not installed")

    # ------------------------------------------------------------------
    # Built-in executors — Telegram
    # ------------------------------------------------------------------

    def _exec_telethon(self, tool, query, max_results, **kw) -> List[dict]:
        """Telethon requires async — provide sync wrapper."""
        import os
        api_id = os.environ.get("TELEGRAM_API_ID")
        api_hash = os.environ.get("TELEGRAM_API_HASH")
        if not api_id or not api_hash:
            raise ValueError("TELEGRAM_API_ID and TELEGRAM_API_HASH required")
        raise ValueError("Telethon requires interactive auth — use telegram-bot-api instead for automated collection")

    def _exec_telegram_bot(self, tool, query, max_results, **kw) -> List[dict]:
        import os, requests
        token = os.environ.get("TELEGRAM_BOT_TOKEN")
        if not token:
            raise ValueError("TELEGRAM_BOT_TOKEN not set")
        resp = requests.get(
            f"https://api.telegram.org/bot{token}/getUpdates",
            params={"limit": max_results},
            timeout=30,
        )
        if resp.status_code != 200:
            raise ValueError(f"Telegram API error: {resp.status_code}")
        data = resp.json()
        results = []
        for update in data.get("result", [])[:max_results]:
            msg = update.get("message", update.get("channel_post", {}))
            if msg:
                results.append({
                    "source": "telegram",
                    "type": "mention",
                    "title": f"Telegram: {msg.get('chat', {}).get('title', 'DM')}",
                    "content": msg.get("text", "")[:2000],
                    "url": "",
                    "metadata": {
                        "chat_id": msg.get("chat", {}).get("id"),
                        "chat_title": msg.get("chat", {}).get("title"),
                        "from": msg.get("from", {}).get("username"),
                        "date": msg.get("date"),
                    }
                })
        return results

    # ------------------------------------------------------------------
    # Status & reporting
    # ------------------------------------------------------------------

    def get_status(self) -> Dict[str, Any]:
        """Get full status of the tool manager."""
        return {
            "initialized": self._initialized,
            "health_report": self.registry.get_health_report(),
            "registered_executors": self.executor_registry.list_registered(),
            "circuit_breakers_open": list(self._circuit_open_since.keys()),
            "effectiveness_matrix": self.registry.get_effectiveness_matrix(),
            "effectiveness_config": self.registry.get_effectiveness_config(),
            "technology_signatures": self.registry.get_technology_signatures(),
        }





"""
HYDRA INTEL - Collector Service Layer

Manages collector lifecycle: running, status tracking, background execution,
and tool-system visibility for registry/failover operations.
"""

import time
import threading
from datetime import datetime, timezone
from typing import Optional, Any

from collectors import GitHubCollector, CVECollector, RedditCollector, PastebinCollector
from collectors.base import BaseCollector
from core.http_client import HttpClient
from core.normalizer import Normalizer
from core.tool_manager import ToolManager
from core.tool_registry import TargetType
from storage.database import IntelDatabase
from core.logger import get_logger

logger = get_logger("service.collector")


class CollectorState:
    """Track the runtime state of a collector."""

    def __init__(self, name: str, source: str, target_type: str, enabled: bool = True):
        self.name = name
        self.source = source
        self.target_type = target_type
        self.enabled = enabled
        self.status: str = "pending"  # active, error, paused, pending, running
        self.last_run: Optional[str] = None
        self.last_query: Optional[str] = None
        self.items_collected: int = 0
        self.items_total: int = 0
        self.errors: list[str] = []
        self.running: bool = False

        # Tool execution telemetry
        self.last_tool: Optional[str] = None
        self.last_fallback_used: bool = False
        self.last_tools_tried: list[str] = []
        self.last_warnings: list[str] = []

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "source": self.source,
            "target_type": self.target_type,
            "status": self.status,
            "enabled": self.enabled,
            "last_run": self.last_run,
            "last_query": self.last_query,
            "items_collected": self.items_collected,
            "items_total": self.items_total,
            "errors": self.errors[-5:],
            "running": self.running,
            "last_tool": self.last_tool,
            "last_fallback_used": self.last_fallback_used,
            "last_tools_tried": self.last_tools_tried,
            "last_warnings": self.last_warnings[-5:],
        }


class CollectorService:
    """Service for managing and executing collectors."""

    def __init__(self, db: IntelDatabase):
        self.db = db
        self.http_client = HttpClient()
        self.normalizer = Normalizer()
        self.tool_manager = ToolManager()
        self._lock = threading.Lock()

        # Event listeners for real-time notifications
        self._listeners: list = []

        # Initialize tool system once at service startup
        self.tool_manager.initialize()

        # Initialize collector states
        self.states: dict[str, CollectorState] = {
            "github": CollectorState("GitHub Code Search", "github", TargetType.GITHUB_INTEL.value),
            "cve": CollectorState("CVE Feed (NVD/CIRCL)", "cve", TargetType.VULNERABILITY_INTEL.value),
            "reddit": CollectorState("Reddit Security Monitor", "reddit", TargetType.REDDIT_INTEL.value),
            "pastebin": CollectorState("Pastebin Scraper", "pastebin", TargetType.PASTE_LEAKS.value),
        }

    def _create_collector(self, source: str) -> Optional[BaseCollector]:
        """Factory for creating collector instances."""
        collectors = {
            "github": lambda: GitHubCollector(self.http_client, tool_manager=self.tool_manager),
            "cve": lambda: CVECollector(self.http_client, tool_manager=self.tool_manager),
            "reddit": lambda: RedditCollector(self.http_client, tool_manager=self.tool_manager),
            "pastebin": lambda: PastebinCollector(self.http_client, tool_manager=self.tool_manager),
        }
        factory = collectors.get(source)
        if factory:
            return factory()
        return None

    def get_all_statuses(self) -> list[dict]:
        """Get status of all collectors."""
        sources_summary = {}
        with self.db._connect() as conn:
            rows = conn.execute(
                "SELECT source, COUNT(*) as total, MAX(collected_at) as last FROM intel GROUP BY source"
            ).fetchall()
            for r in rows:
                sources_summary[r["source"]] = {"total": r["total"], "last": r["last"]}

        result = []
        for source, state in self.states.items():
            data = state.to_dict()
            db_info = sources_summary.get(source, {})
            data["items_total"] = db_info.get("total", 0)
            if not state.last_run and db_info.get("last"):
                data["last_run"] = db_info["last"]
            result.append(data)
        return result

    def get_status(self, source: str) -> Optional[dict]:
        """Get status of a specific collector."""
        state = self.states.get(source)
        if state:
            return state.to_dict()
        return None

    def run_collector(
        self,
        source: str,
        query: Optional[str] = None,
        max_results: int = 50,
        preferred_tool: Optional[str] = None,
        use_tool_registry: bool = True,
        scan_signatures: bool = True,
    ) -> dict:
        """Run a collector synchronously and return results."""
        state = self.states.get(source)
        if not state:
            return {"error": f"Unknown source: {source}"}

        if state.running:
            return {"error": f"Collector {source} is already running"}

        collector = self._create_collector(source)
        if not collector:
            return {"error": f"Failed to create collector for {source}"}

        default_queries = {
            "github": "api_key filename:.env",
            "cve": "",
            "reddit": "data breach OR vulnerability",
            "pastebin": "password",
        }
        query = query or default_queries.get(source, "")

        with self._lock:
            state.running = True
            state.status = "running"

        start = time.time()
        result = {
            "source": source,
            "query": query,
            "collected": 0,
            "inserted": 0,
            "duplicates": 0,
            "errors": [],
            "elapsed": 0.0,
            "tool_name": None,
            "tools_tried": [],
            "fallback_used": False,
            "warnings": [],
        }

        try:
            logger.info("Running collector: %s query='%s' max=%d", source, query, max_results)
            raw_items = collector.collect(
                query,
                max_results,
                preferred_tool=preferred_tool,
                use_tool_registry=use_tool_registry,
                scan_signatures=scan_signatures,
            )
            result["collected"] = len(raw_items)
            result["errors"].extend(getattr(collector, "errors", []))

            last_result = getattr(collector, "last_result", None)
            if last_result is not None:
                result["tool_name"] = last_result.tool_name
                result["tools_tried"] = last_result.tools_tried
                result["fallback_used"] = last_result.fallback_used
                result["warnings"] = last_result.warnings

            if raw_items:
                records = self.normalizer.normalize_batch(raw_items)
                store_result = self.db.insert_batch(records)
                result["inserted"] = store_result["inserted"]
                result["duplicates"] = store_result["duplicates"]

                if store_result["inserted"] > 0:
                    self._notify_listeners({
                        "event": "new_threats",
                        "source": source,
                        "count": store_result["inserted"],
                    })

            state.status = "active" if not result["errors"] else "error"
            state.items_collected += result["inserted"]
            state.last_run = datetime.now(timezone.utc).isoformat()
            state.last_query = query
            state.errors = result["errors"]
            state.last_tool = result["tool_name"]
            state.last_fallback_used = result["fallback_used"]
            state.last_tools_tried = result["tools_tried"]
            state.last_warnings = result["warnings"]

        except Exception as e:
            logger.error("Collector %s crashed: %s", source, e)
            state.status = "error"
            state.errors.append(str(e))
            result["errors"].append(str(e))
        finally:
            state.running = False
            result["elapsed"] = round(time.time() - start, 2)

        logger.info(
            "Collector %s done: collected=%d inserted=%d dupes=%d errors=%d (%.1fs)",
            source,
            result["collected"],
            result["inserted"],
            result["duplicates"],
            len(result["errors"]),
            result["elapsed"],
        )
        return result

    def run_collector_background(
        self,
        source: str,
        query: Optional[str] = None,
        max_results: int = 50,
        preferred_tool: Optional[str] = None,
        use_tool_registry: bool = True,
        scan_signatures: bool = True,
    ):
        """Run a collector in a background thread."""
        thread = threading.Thread(
            target=self.run_collector,
            args=(source, query, max_results, preferred_tool, use_tool_registry, scan_signatures),
            daemon=True,
        )
        thread.start()
        return {"message": f"Collector {source} started in background"}

    def run_all_background(
        self,
        max_results: int = 50,
        use_tool_registry: bool = True,
        scan_signatures: bool = True,
    ):
        """Run all enabled collectors in background."""
        started = []
        for source, state in self.states.items():
            if state.enabled and not state.running:
                self.run_collector_background(
                    source,
                    max_results=max_results,
                    use_tool_registry=use_tool_registry,
                    scan_signatures=scan_signatures,
                )
                started.append(source)
        return {"message": f"Started {len(started)} collectors", "sources": started}

    def toggle_collector(self, source: str, enabled: bool) -> Optional[dict]:
        """Enable or disable a collector."""
        state = self.states.get(source)
        if not state:
            return None
        state.enabled = enabled
        if not enabled:
            state.status = "paused"
        return state.to_dict()

    # Tool-system APIs

    def get_tool_manager_status(self) -> dict[str, Any]:
        return self.tool_manager.get_status()

    def get_tool_targets(self) -> list[dict]:
        return self.tool_manager.registry.get_target_types()

    def get_tools(self, target_type: Optional[str] = None) -> list[dict]:
        if not target_type:
            return [t.to_dict() for t in self.tool_manager.registry.get_all_tools()]

        target = next((t for t in TargetType if t.value == target_type), None)
        if not target:
            return []
        return [t.to_dict() for t in self.tool_manager.registry.get_tools_for_target(target)]

    def get_source_tools(self, source: str) -> list[dict]:
        state = self.states.get(source)
        if not state:
            return []
        return self.get_tools(state.target_type)

    def add_listener(self, callback):
        """Register a real-time event listener."""
        self._listeners.append(callback)

    def remove_listener(self, callback):
        """Remove an event listener."""
        self._listeners = [l for l in self._listeners if l is not callback]

    def _notify_listeners(self, event: dict):
        """Notify all registered listeners."""
        for listener in self._listeners:
            try:
                listener(event)
            except Exception as e:
                logger.error("Listener error: %s", e)

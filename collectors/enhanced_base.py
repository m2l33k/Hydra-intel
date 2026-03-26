"""
HYDRA INTEL - Enhanced Base Collector

Base class for tool-registry-aware collectors that support
automatic failover between multiple OSINT tools.
"""

import time
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any

from config import settings
from core.logger import get_logger
from core.http_client import HttpClient
from core.tool_registry import TargetType, ToolStatus
from core.tool_manager import ToolManager, ToolExecutionResult
from core.signatures import SignatureScanner

logger = get_logger("enhanced_collector")


class EnhancedBaseCollector(ABC):
    """
    Enhanced collector base that integrates with the ToolManager.

    Features over the original BaseCollector:
    - Automatic tool selection and failover
    - Signature scanning on collected data
    - Per-tool health tracking
    - Multi-tool result merging
    """

    def __init__(
        self,
        tool_manager: Optional[ToolManager] = None,
        http_client: Optional[HttpClient] = None,
        scanner: Optional[SignatureScanner] = None,
    ):
        self.tool_manager = tool_manager or ToolManager()
        self.client = http_client or HttpClient()
        self.scanner = scanner or SignatureScanner()
        self._errors: List[str] = []
        self._last_result: Optional[ToolExecutionResult] = None

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Unique identifier for this data source."""
        raise NotImplementedError

    @property
    @abstractmethod
    def target_type(self) -> TargetType:
        """The TargetType this collector maps to."""
        raise NotImplementedError

    @property
    def default_query(self) -> str:
        """Default search query for this collector."""
        return ""

    @property
    def errors(self) -> List[str]:
        return list(self._errors)

    @property
    def last_result(self) -> Optional[ToolExecutionResult]:
        return self._last_result

    def collect(
        self,
        query: str = "",
        max_results: int = 50,
        preferred_tool: Optional[str] = None,
        scan_signatures: bool = True,
        **kwargs,
    ) -> List[dict]:
        """
        Collect intelligence using the best available tool with auto-failover.
        """
        self._errors = []
        effective_query = query or self.default_query

        result = self.tool_manager.run(
            target_type=self.target_type,
            query=effective_query,
            max_results=max_results,
            preferred_tool=preferred_tool,
            **kwargs,
        )
        self._last_result = result

        if not result.success:
            self._add_error(result.error or "Collection failed")
            logger.warning("[%s] Collection failed: %s", self.source_name, result.error)
            return []

        records = result.data

        if scan_signatures and records:
            records = self._enrich_with_signatures(records)

        records = self._filter_and_tag(records)

        logger.info(
            "[%s] Collected %d items via '%s' (fallback=%s, tried=%s)",
            self.source_name,
            len(records),
            result.tool_name,
            result.fallback_used,
            result.tools_tried,
        )

        for warning in result.warnings:
            self._add_error(f"Warning: {warning}")

        return records

    def collect_multi_tool(
        self,
        query: str = "",
        max_results: int = 50,
        merge: bool = True,
        **kwargs,
    ) -> Dict[str, List[dict]]:
        """Run all available tools for this target type."""
        effective_query = query or self.default_query
        chain = self.tool_manager.registry.get_fallback_chain(self.target_type)

        per_tool: Dict[str, List[dict]] = {}
        for tool in chain:
            result = self.tool_manager.run(
                target_type=self.target_type,
                query=effective_query,
                max_results=max_results,
                preferred_tool=tool.name,
                **kwargs,
            )
            if result.success and result.data:
                per_tool[tool.name] = result.data

        if merge:
            seen_urls = set()
            merged: List[dict] = []
            for tool_name, records in per_tool.items():
                for record in records:
                    url = record.get("url", "")
                    if url and url in seen_urls:
                        continue
                    if url:
                        seen_urls.add(url)
                    record["_collected_by"] = tool_name
                    merged.append(record)
            return {"merged": merged}

        return per_tool

    def get_available_tools(self) -> List[Dict[str, Any]]:
        """List all tools available for this collector's target type."""
        tools = self.tool_manager.registry.get_tools_for_target(self.target_type)
        return [tool.to_dict() for tool in tools]

    def get_tool_health(self) -> Dict[str, Any]:
        """Get health status of tools for this collector's target type."""
        tools = self.tool_manager.registry.get_tools_for_target(self.target_type)
        return {
            "target_type": self.target_type.value,
            "total_tools": len(tools),
            "available": len([tool for tool in tools if tool.status == ToolStatus.AVAILABLE]),
            "tools": [
                {
                    "name": tool.name,
                    "status": tool.status.value,
                    "health_score": round(tool.health_score, 3),
                    "effectiveness": tool.effectiveness,
                    "success_rate": round(tool.success_rate, 3),
                    "consecutive_errors": tool.consecutive_errors,
                }
                for tool in tools
            ],
        }

    def _enrich_with_signatures(self, records: List[dict]) -> List[dict]:
        """Run signature scanner on each record and attach results."""
        for record in records:
            scan = self.scanner.scan_intel_record(record)
            if scan.total_matches > 0:
                metadata = record.get("metadata", {})
                if isinstance(metadata, str):
                    metadata = {}
                metadata["signature_scan"] = {
                    "risk_score": round(scan.risk_score, 2),
                    "total_matches": scan.total_matches,
                    "critical": scan.critical_count,
                    "high": scan.high_count,
                    "categories": list(scan.categories_hit),
                }
                record["metadata"] = metadata

                if scan.critical_count > 0 and record.get("type") not in ("leak", "alert"):
                    record["type"] = "alert"
                elif scan.risk_score >= 5.0 and record.get("type") == "mention":
                    record["type"] = "alert"

        return records

    def _filter_and_tag(self, records: List[dict]) -> List[dict]:
        """Tag records with matched alert keywords."""
        for record in records:
            text = f"{record.get('title', '')} {record.get('content', '')}"
            matched = self._matches_keywords(text)
            if matched:
                metadata = record.get("metadata", {})
                if isinstance(metadata, str):
                    metadata = {}
                metadata["matched_keywords"] = matched
                record["metadata"] = metadata
        return records

    def _matches_keywords(self, text: str) -> List[str]:
        if not text:
            return []
        text_lower = text.lower()
        return [kw for kw in settings.alert_keywords if kw in text_lower]

    def _add_error(self, message: str):
        self._errors.append(message)
        logger.warning("[%s] %s", self.source_name, message)

    def _rate_limit(self):
        delay = settings.rate_limit_delay
        if delay > 0:
            time.sleep(delay)

    def reset(self):
        self._errors = []
        self._last_result = None

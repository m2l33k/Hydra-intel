"""
HYDRA INTEL - CVE Collector

Collects latest vulnerability data from the NIST NVD and CIRCL CVE API.
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

NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
CIRCL_CVE_RECENT_URL = "https://cve.circl.lu/api/last"
CIRCL_CVE_SEARCH_URL = "https://cve.circl.lu/api/search"


class CVECollector(EnhancedBaseCollector):
    """Collect recent CVE vulnerability data."""

    def __init__(
        self,
        http_client: Optional[HttpClient] = None,
        tool_manager: Optional[ToolManager] = None,
        scanner: Optional[SignatureScanner] = None,
        use_tool_registry: bool = True,
    ):
        super().__init__(tool_manager=tool_manager, http_client=http_client, scanner=scanner)
        self.use_tool_registry = use_tool_registry
        logger.info("CVE collector initialized")

    @property
    def source_name(self) -> str:
        return "cve"

    @property
    def target_type(self) -> TargetType:
        return TargetType.VULNERABILITY_INTEL

    @property
    def default_query(self) -> str:
        return ""

    def collect(
        self,
        query: str = "",
        max_results: int = 0,
        preferred_tool: Optional[str] = None,
        use_tool_registry: Optional[bool] = None,
        scan_signatures: bool = True,
        **kwargs,
    ) -> list[dict]:
        """Collect CVEs, optionally filtered by keyword."""
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
        """Direct collection path used by tool executors."""
        self.reset()

        results = self._collect_from_circl(query, max_results)
        if not results:
            logger.info("CIRCL API returned no results, trying NVD...")
            results = self._collect_from_nvd(query, max_results)

        logger.info("CVE collector returned %d results for query '%s'", len(results), query or "*")
        return results

    def _collect_from_circl(self, query: str, max_results: int) -> list[dict]:
        results = []

        if query:
            data = self.client.get_json(f"{CIRCL_CVE_SEARCH_URL}/{query}")
        else:
            data = self.client.get_json(CIRCL_CVE_RECENT_URL)

        if not data or not isinstance(data, list):
            self._add_error("CIRCL API returned invalid data")
            return results

        for advisory in data:
            if len(results) >= max_results:
                break

            vulns = advisory.get("vulnerabilities", [])
            if not vulns and advisory.get("id", "").startswith("CVE"):
                vulns = [advisory]

            for vuln in vulns:
                if len(results) >= max_results:
                    break

                cve_id = vuln.get("cve", vuln.get("id", ""))
                title = vuln.get("title", cve_id)

                summary = ""
                notes = vuln.get("notes", [])
                for note in notes:
                    cat = note.get("category", "")
                    if cat == "description":
                        summary = note.get("text", "")
                        break
                    if cat == "summary" and not summary:
                        summary = note.get("text", "")

                if not summary:
                    summary = vuln.get("summary", "")

                cvss_score = None
                scores = vuln.get("scores", [])
                if scores:
                    cvss_data = scores[0].get("cvss_v3", scores[0].get("cvss_v2", {}))
                    cvss_score = cvss_data.get("baseScore")

                if query and query.lower() not in f"{cve_id} {title} {summary}".lower():
                    continue

                matched_keywords = self._matches_keywords(summary)

                record = {
                    "source": self.source_name,
                    "type": "vuln",
                    "title": title or cve_id,
                    "content": summary,
                    "url": f"https://cve.circl.lu/cve/{cve_id}" if cve_id else "",
                    "collected_at": datetime.now(timezone.utc).isoformat(),
                    "metadata": {
                        "cve_id": cve_id,
                        "cvss_score": cvss_score,
                        "release_date": vuln.get("release_date", ""),
                        "cwe": vuln.get("cwe", {}).get("id", ""),
                        "matched_keywords": matched_keywords,
                    },
                }
                results.append(record)

        return results

    def _collect_from_nvd(self, query: str, max_results: int) -> list[dict]:
        results = []

        params = {"resultsPerPage": min(max_results, 50)}
        if query:
            params["keywordSearch"] = query

        data = self.client.get_json(NVD_API_URL, params=params)
        if not data or "vulnerabilities" not in data:
            self._add_error("NVD API returned no data")
            return results

        for vuln_wrapper in data["vulnerabilities"][:max_results]:
            cve = vuln_wrapper.get("cve", {})
            cve_id = cve.get("id", "")

            descriptions = cve.get("descriptions", [])
            summary = ""
            for desc in descriptions:
                if desc.get("lang") == "en":
                    summary = desc.get("value", "")
                    break
            if not summary and descriptions:
                summary = descriptions[0].get("value", "")

            metrics = cve.get("metrics", {})
            cvss_score = None
            for version in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
                metric_list = metrics.get(version, [])
                if metric_list:
                    cvss_data = metric_list[0].get("cvssData", {})
                    cvss_score = cvss_data.get("baseScore")
                    break

            matched_keywords = self._matches_keywords(summary)

            record = {
                "source": self.source_name,
                "type": "vuln",
                "title": cve_id,
                "content": summary,
                "url": f"https://nvd.nist.gov/vuln/detail/{cve_id}",
                "collected_at": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "cve_id": cve_id,
                    "cvss_score": cvss_score,
                    "published": cve.get("published", ""),
                    "modified": cve.get("lastModified", ""),
                    "source_identifier": cve.get("sourceIdentifier", ""),
                    "matched_keywords": matched_keywords,
                },
            }
            results.append(record)

        self._rate_limit()
        return results

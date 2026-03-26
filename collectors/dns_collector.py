"""
HYDRA INTEL - DNS & Infrastructure Collector

Collects DNS and infrastructure intelligence using the tool registry with failover
(subfinder, assetfinder, dnsdumpster, waybackurls, gau, katana, httpx, etc.).
"""

from typing import Optional

from collectors.enhanced_base import EnhancedBaseCollector
from config import settings
from core.http_client import HttpClient
from core.logger import get_logger
from core.signatures import SignatureScanner
from core.tool_manager import ToolManager
from core.tool_registry import TargetType

logger = get_logger(__name__)


class DNSCollector(EnhancedBaseCollector):
    """Collect DNS intelligence — subdomains, records, historical URLs."""

    def __init__(
        self,
        http_client: Optional[HttpClient] = None,
        tool_manager: Optional[ToolManager] = None,
        scanner: Optional[SignatureScanner] = None,
        use_tool_registry: bool = True,
    ):
        super().__init__(tool_manager=tool_manager, http_client=http_client, scanner=scanner)
        self.use_tool_registry = use_tool_registry
        logger.info("DNS collector initialized")

    @property
    def source_name(self) -> str:
        return "dns"

    @property
    def target_type(self) -> TargetType:
        return TargetType.DNS_INTEL

    @property
    def default_query(self) -> str:
        return "example.com"

    def collect(
        self,
        query: str = "",
        max_results: int = 0,
        preferred_tool: Optional[str] = None,
        use_tool_registry: Optional[bool] = None,
        scan_signatures: bool = True,
        **kwargs,
    ) -> list[dict]:
        max_results = max_results or settings.default_max_results
        use_registry = self.use_tool_registry if use_tool_registry is None else use_tool_registry

        if not use_registry and preferred_tool is None:
            preferred_tool = "subfinder"

        return super().collect(
            query=query,
            max_results=max_results,
            preferred_tool=preferred_tool,
            scan_signatures=scan_signatures,
            **kwargs,
        )


class InfrastructureCollector(EnhancedBaseCollector):
    """Collect infrastructure intelligence — hosts, ports, services."""

    def __init__(
        self,
        http_client: Optional[HttpClient] = None,
        tool_manager: Optional[ToolManager] = None,
        scanner: Optional[SignatureScanner] = None,
        use_tool_registry: bool = True,
    ):
        super().__init__(tool_manager=tool_manager, http_client=http_client, scanner=scanner)
        self.use_tool_registry = use_tool_registry
        logger.info("Infrastructure collector initialized")

    @property
    def source_name(self) -> str:
        return "infrastructure"

    @property
    def target_type(self) -> TargetType:
        return TargetType.INFRASTRUCTURE_INTEL

    @property
    def default_query(self) -> str:
        return "apache"

    def collect(
        self,
        query: str = "",
        max_results: int = 0,
        preferred_tool: Optional[str] = None,
        use_tool_registry: Optional[bool] = None,
        scan_signatures: bool = True,
        **kwargs,
    ) -> list[dict]:
        max_results = max_results or settings.default_max_results
        use_registry = self.use_tool_registry if use_tool_registry is None else use_tool_registry

        if not use_registry and preferred_tool is None:
            preferred_tool = "shodan-cli"

        return super().collect(
            query=query,
            max_results=max_results,
            preferred_tool=preferred_tool,
            scan_signatures=scan_signatures,
            **kwargs,
        )

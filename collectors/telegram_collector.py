"""
HYDRA INTEL - Telegram Collector

Collects Telegram intelligence using the tool registry with failover
(telethon, telegram bot API, telegram-history-dump, etc.).
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


class TelegramCollector(EnhancedBaseCollector):
    """Collect security intelligence from Telegram channels/groups."""

    def __init__(
        self,
        http_client: Optional[HttpClient] = None,
        tool_manager: Optional[ToolManager] = None,
        scanner: Optional[SignatureScanner] = None,
        use_tool_registry: bool = True,
    ):
        super().__init__(tool_manager=tool_manager, http_client=http_client, scanner=scanner)
        self.use_tool_registry = use_tool_registry
        logger.info("Telegram collector initialized")

    @property
    def source_name(self) -> str:
        return "telegram"

    @property
    def target_type(self) -> TargetType:
        return TargetType.TELEGRAM_INTEL

    @property
    def default_query(self) -> str:
        return "breach OR malware OR stealer"

    def collect(
        self,
        query: str = "",
        max_results: int = 0,
        preferred_tool: Optional[str] = None,
        use_tool_registry: Optional[bool] = None,
        scan_signatures: bool = True,
        **kwargs,
    ) -> list[dict]:
        """Collect Telegram intelligence with tool-manager fallback."""
        max_results = max_results or settings.default_max_results
        use_registry = self.use_tool_registry if use_tool_registry is None else use_tool_registry

        if not use_registry and preferred_tool is None:
            # Direct mode fallback when callers explicitly disable registry.
            preferred_tool = "telegram-bot-api"

        return super().collect(
            query=query,
            max_results=max_results,
            preferred_tool=preferred_tool,
            scan_signatures=scan_signatures,
            **kwargs,
        )

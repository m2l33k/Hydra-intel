"""
HYDRA INTEL - Normalization Layer

Converts raw collector output into a unified intelligence format.
All data flowing into storage passes through this layer.
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Optional

from core.logger import get_logger

logger = get_logger(__name__)


class IntelRecord:
    """Unified intelligence record format.

    Every piece of collected data is normalized into this structure
    before being persisted to storage.
    """

    __slots__ = (
        "source", "intel_type", "title", "content",
        "url", "collected_at", "metadata", "fingerprint",
    )

    def __init__(
        self,
        source: str,
        intel_type: str,
        title: str,
        content: str,
        url: str,
        collected_at: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        self.source = source
        self.intel_type = intel_type
        self.title = title
        self.content = content
        self.url = url
        self.collected_at = collected_at or datetime.now(timezone.utc).isoformat()
        self.metadata = metadata or {}
        self.fingerprint = self._generate_fingerprint()

    def _generate_fingerprint(self) -> str:
        """Generate a SHA-256 fingerprint for deduplication.

        Based on source + URL + title to detect duplicates
        even when content varies slightly.
        """
        unique_str = f"{self.source}|{self.url}|{self.title}"
        return hashlib.sha256(unique_str.encode("utf-8")).hexdigest()

    def to_dict(self) -> dict:
        """Serialize to dictionary."""
        return {
            "source": self.source,
            "type": self.intel_type,
            "title": self.title,
            "content": self.content,
            "url": self.url,
            "collected_at": self.collected_at,
            "metadata": self.metadata,
            "fingerprint": self.fingerprint,
        }

    def __repr__(self) -> str:
        return f"<IntelRecord source={self.source} type={self.intel_type} title={self.title[:40]}>"


class Normalizer:
    """Normalize raw collector data into IntelRecord instances."""

    VALID_TYPES = {"leak", "vuln", "mention", "alert", "report", "paste", "code"}

    @classmethod
    def normalize(
        cls,
        source: str,
        intel_type: str,
        title: str,
        content: str,
        url: str,
        collected_at: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> IntelRecord:
        """Create a normalized IntelRecord from raw fields.

        Args:
            source: Data source identifier (e.g., 'github', 'cve', 'reddit').
            intel_type: Classification type (leak, vuln, mention, etc.).
            title: Title or headline.
            content: Main content body.
            url: Source URL.
            collected_at: ISO timestamp (auto-generated if omitted).
            metadata: Additional key-value data.

        Returns:
            IntelRecord instance.
        """
        if intel_type not in cls.VALID_TYPES:
            logger.warning("Unknown intel type '%s', defaulting to 'mention'", intel_type)
            intel_type = "mention"

        title = (title or "Untitled").strip()[:500]
        content = (content or "").strip()[:10000]
        url = (url or "").strip()

        return IntelRecord(
            source=source,
            intel_type=intel_type,
            title=title,
            content=content,
            url=url,
            collected_at=collected_at,
            metadata=metadata,
        )

    @classmethod
    def normalize_batch(cls, raw_items: list[dict]) -> list[IntelRecord]:
        """Normalize a batch of raw dicts into IntelRecords.

        Each dict must contain: source, type, title, content, url.
        Optional: collected_at, metadata.

        Args:
            raw_items: List of raw data dicts.

        Returns:
            List of IntelRecord instances.
        """
        records = []
        for item in raw_items:
            try:
                record = cls.normalize(
                    source=item.get("source", "unknown"),
                    intel_type=item.get("type", "mention"),
                    title=item.get("title", ""),
                    content=item.get("content", ""),
                    url=item.get("url", ""),
                    collected_at=item.get("collected_at"),
                    metadata=item.get("metadata"),
                )
                records.append(record)
            except Exception as e:
                logger.error("Failed to normalize item: %s — %s", item, e)
        return records

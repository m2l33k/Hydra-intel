"""
HYDRA INTEL - Intelligence Processing Pipeline

Orchestrates the flow: Collect → Parse → Normalize → Store.
Handles failures gracefully with per-record error isolation.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Optional

from collectors.base import BaseCollector
from core.normalizer import Normalizer, IntelRecord
from storage.database import IntelDatabase
from config import settings
from core.logger import get_logger

logger = get_logger(__name__)


@dataclass
class PipelineResult:
    """Result of a pipeline run."""
    source: str
    query: str
    collected: int = 0
    normalized: int = 0
    inserted: int = 0
    duplicates: int = 0
    errors: list = field(default_factory=list)

    @property
    def success(self) -> bool:
        return self.collected > 0 and not self.errors

    def summary(self) -> str:
        status = "OK" if self.success else "PARTIAL" if self.collected > 0 else "FAILED"
        return (
            f"[{status}] {self.source} | query='{self.query}' | "
            f"collected={self.collected} normalized={self.normalized} "
            f"inserted={self.inserted} duplicates={self.duplicates} "
            f"errors={len(self.errors)}"
        )


class IntelPipeline:
    """Main intelligence processing pipeline.

    Processes data from collectors through normalization and into storage.
    Supports both sequential and concurrent execution of multiple collectors.
    """

    def __init__(self, db: Optional[IntelDatabase] = None):
        self.db = db or IntelDatabase()
        self.normalizer = Normalizer()

    def process_collector(
        self,
        collector: BaseCollector,
        query: str,
        max_results: int = 0,
    ) -> PipelineResult:
        """Run a single collector through the full pipeline.

        Args:
            collector: Collector instance to run.
            query: Search query.
            max_results: Maximum results to collect.

        Returns:
            PipelineResult with statistics.
        """
        result = PipelineResult(source=collector.source_name, query=query)

        # Step 1: Collect raw data
        logger.info("Pipeline: collecting from %s for query '%s'", collector.source_name, query)
        try:
            raw_items = collector.collect(query, max_results)
            result.collected = len(raw_items)
            result.errors.extend(collector.errors)
        except Exception as e:
            logger.error("Pipeline: collector %s crashed: %s", collector.source_name, e)
            result.errors.append(f"Collector crash: {e}")
            return result

        if not raw_items:
            logger.warning("Pipeline: no data collected from %s", collector.source_name)
            return result

        # Step 2: Normalize
        logger.info("Pipeline: normalizing %d items from %s", len(raw_items), collector.source_name)
        try:
            records = self.normalizer.normalize_batch(raw_items)
            result.normalized = len(records)
        except Exception as e:
            logger.error("Pipeline: normalization failed for %s: %s", collector.source_name, e)
            result.errors.append(f"Normalization error: {e}")
            return result

        # Step 3: Store with deduplication
        logger.info("Pipeline: storing %d records from %s", len(records), collector.source_name)
        try:
            store_result = self.db.insert_batch(records)
            result.inserted = store_result["inserted"]
            result.duplicates = store_result["duplicates"]
        except Exception as e:
            logger.error("Pipeline: storage failed for %s: %s", collector.source_name, e)
            result.errors.append(f"Storage error: {e}")

        logger.info("Pipeline: %s", result.summary())
        return result

    def run_sequential(
        self,
        tasks: list[tuple[BaseCollector, str, int]],
    ) -> list[PipelineResult]:
        """Run multiple collector tasks sequentially.

        Args:
            tasks: List of (collector, query, max_results) tuples.

        Returns:
            List of PipelineResults.
        """
        results = []
        for collector, query, max_results in tasks:
            result = self.process_collector(collector, query, max_results)
            results.append(result)
        return results

    def run_concurrent(
        self,
        tasks: list[tuple[BaseCollector, str, int]],
        max_workers: int = 4,
    ) -> list[PipelineResult]:
        """Run multiple collector tasks concurrently using threads.

        Args:
            tasks: List of (collector, query, max_results) tuples.
            max_workers: Maximum concurrent threads.

        Returns:
            List of PipelineResults.
        """
        results = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(self.process_collector, collector, query, max_results): (
                    collector.source_name,
                    query,
                )
                for collector, query, max_results in tasks
            }
            for future in as_completed(future_map):
                source, query = future_map[future]
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    logger.error("Pipeline thread error for %s: %s", source, e)
                    results.append(PipelineResult(
                        source=source,
                        query=query,
                        errors=[f"Thread error: {e}"],
                    ))
        return results

    async def run_async(
        self,
        tasks: list[tuple[BaseCollector, str, int]],
    ) -> list[PipelineResult]:
        """Run multiple collector tasks using asyncio with thread offloading.

        Designed for future migration to fully async collectors.

        Args:
            tasks: List of (collector, query, max_results) tuples.

        Returns:
            List of PipelineResults.
        """
        loop = asyncio.get_event_loop()
        futures = [
            loop.run_in_executor(None, self.process_collector, collector, query, max_results)
            for collector, query, max_results in tasks
        ]
        return await asyncio.gather(*futures, return_exceptions=False)

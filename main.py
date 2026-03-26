#!/usr/bin/env python3
"""
HYDRA INTEL - Surface OSINT Intelligence Engine

Main entry point. Runs the intelligence collection pipeline
across configured sources and prints execution statistics.

Usage:
    python main.py                    # Run all collectors with defaults
    python main.py --query "CVE-2024" # Run with a custom query
    python main.py --source github    # Run a specific collector
    python main.py --mode concurrent  # Run collectors in parallel
"""

import argparse
import sys
import time
from datetime import datetime, timezone

from config import settings
from collectors import GitHubCollector, CVECollector, RedditCollector, PastebinCollector
from core.http_client import HttpClient
from core.logger import get_logger
from pipelines.intel_pipeline import IntelPipeline, PipelineResult
from storage.database import IntelDatabase

logger = get_logger("main")

BANNER = """
 _   ___   ______  ____    _       ___ _   _ _____ _____ _
| | | \\ \\ / /  _ \\|  _ \\  / \\     |_ _| \\ | |_   _| ____| |
| |_| |\\ V /| | | | |_) |/ _ \\     | ||  \\| | | | |  _| | |
|  _  | | | | |_| |  _ </ ___ \\    | || |\\  | | | | |___| |___
|_| |_| |_| |____/|_| \\_/_/   \\_\\  |___|_| \\_| |_| |_____|_____|
 Surface OSINT Intelligence Engine v{version}
"""


def build_collectors(source: str | None, http_client: HttpClient) -> dict:
    """Build collector instances based on source filter.

    Args:
        source: Specific source name, or None for all.
        http_client: Shared HTTP client.

    Returns:
        Dict mapping source name to collector instance.
    """
    all_collectors = {
        "github": lambda: GitHubCollector(http_client),
        "cve": lambda: CVECollector(http_client),
        "reddit": lambda: RedditCollector(http_client),
        "pastebin": lambda: PastebinCollector(http_client),
    }

    if source:
        if source not in all_collectors:
            logger.error("Unknown source: %s. Available: %s", source, ", ".join(all_collectors))
            sys.exit(1)
        return {source: all_collectors[source]()}

    return {name: factory() for name, factory in all_collectors.items()}


def build_tasks(collectors: dict, query: str, max_results: int) -> list:
    """Build pipeline task list from collectors.

    Each collector gets the same query (or a source-specific default).

    Args:
        collectors: Dict of source_name -> collector.
        query: User-provided query.
        max_results: Max results per collector.

    Returns:
        List of (collector, query, max_results) tuples.
    """
    # Source-specific default queries when no query is provided
    default_queries = {
        "github": "api_key filename:.env",
        "cve": "",  # CVE collector fetches recent by default
        "reddit": "data breach OR vulnerability OR exploit",
        "pastebin": "password",
    }

    tasks = []
    for name, collector in collectors.items():
        q = query if query else default_queries.get(name, "security")
        tasks.append((collector, q, max_results))
    return tasks


def print_stats(results: list[PipelineResult], elapsed: float, db: IntelDatabase):
    """Print execution statistics."""
    print("\n" + "=" * 70)
    print("  COLLECTION REPORT")
    print("=" * 70)

    total_collected = 0
    total_inserted = 0
    total_duplicates = 0
    total_errors = 0

    for r in results:
        total_collected += r.collected
        total_inserted += r.inserted
        total_duplicates += r.duplicates
        total_errors += len(r.errors)
        status = "OK" if r.success else "WARN" if r.collected > 0 else "FAIL"
        print(f"  [{status:4s}] {r.source:<12s} | collected: {r.collected:>4d} | "
              f"stored: {r.inserted:>4d} | dupes: {r.duplicates:>4d} | "
              f"errors: {len(r.errors):>2d}")
        if r.errors:
            for err in r.errors[:3]:
                print(f"         `- {err}")

    print("-" * 70)
    print(f"  Total collected:  {total_collected}")
    print(f"  Total stored:     {total_inserted}")
    print(f"  Duplicates:       {total_duplicates}")
    print(f"  Errors:           {total_errors}")
    print(f"  Sources used:     {len(results)}")
    print(f"  Elapsed time:     {elapsed:.2f}s")

    # Database stats
    db_stats = db.stats()
    print(f"\n  Database total:   {db_stats['total_records']} records")
    if db_stats["by_source"]:
        print("  By source:", ", ".join(f"{k}={v}" for k, v in db_stats["by_source"].items()))
    if db_stats["by_type"]:
        print("  By type:  ", ", ".join(f"{k}={v}" for k, v in db_stats["by_type"].items()))

    print("=" * 70 + "\n")


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="HYDRA INTEL - Surface OSINT Intelligence Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-q", "--query",
        type=str,
        default="",
        help="Search query to run across collectors (default: source-specific)",
    )
    parser.add_argument(
        "-s", "--source",
        type=str,
        default=None,
        choices=["github", "cve", "reddit", "pastebin"],
        help="Run a specific collector only",
    )
    parser.add_argument(
        "-m", "--mode",
        type=str,
        default="sequential",
        choices=["sequential", "concurrent"],
        help="Execution mode (default: sequential)",
    )
    parser.add_argument(
        "-n", "--max-results",
        type=int,
        default=0,
        help="Max results per collector (default: from config)",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=None,
        help="Database file path (default: intel.db)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging",
    )
    return parser.parse_args()


def main():
    """Main entry point for HYDRA INTEL."""
    args = parse_args()

    print(BANNER.format(version=settings.app_version))

    if args.debug:
        import logging
        logging.getLogger("hydra").setLevel(logging.DEBUG)

    logger.info("Starting HYDRA INTEL v%s", settings.app_version)
    logger.info("Timestamp: %s", datetime.now(timezone.utc).isoformat())

    # Initialize components
    http_client = HttpClient()
    db = IntelDatabase(db_path=args.db)
    pipeline = IntelPipeline(db=db)

    # Build collectors and tasks
    collectors = build_collectors(args.source, http_client)
    tasks = build_tasks(collectors, args.query, args.max_results)

    logger.info(
        "Running %d collector(s) in %s mode",
        len(tasks),
        args.mode,
    )

    # Execute pipeline
    start_time = time.time()

    if args.mode == "concurrent":
        results = pipeline.run_concurrent(tasks)
    else:
        results = pipeline.run_sequential(tasks)

    elapsed = time.time() - start_time

    # Report
    print_stats(results, elapsed, db)

    # Sample data preview
    recent = db.query(limit=5)
    if recent:
        print("  LATEST RECORDS (sample):")
        print("-" * 70)
        for rec in recent:
            print(f"  [{rec['type']:>7s}] [{rec['source']:<10s}] {rec['title'][:60]}")
            if rec.get("url"):
                print(f"           {rec['url'][:70]}")
        print()

    http_client.close()
    logger.info("HYDRA INTEL run complete in %.2fs", elapsed)


if __name__ == "__main__":
    main()

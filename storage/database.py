"""
HYDRA INTEL - Database Storage Layer

SQLite storage with a schema designed for PostgreSQL migration.
Handles insert, deduplication, and basic querying.
"""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from config import settings
from core.normalizer import IntelRecord
from core.logger import get_logger

logger = get_logger(__name__)

# Schema designed for PostgreSQL compatibility:
# - Uses TEXT instead of VARCHAR (valid in both)
# - Uses REAL for floats (maps to DOUBLE PRECISION in PG)
# - Uses JSON-as-TEXT (migrate to JSONB in PG)
# - fingerprint as UNIQUE for deduplication
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS intel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    url TEXT,
    collected_at TEXT NOT NULL,
    metadata TEXT,
    fingerprint TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
"""

CREATE_INDEXES_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_intel_source ON intel(source);",
    "CREATE INDEX IF NOT EXISTS idx_intel_type ON intel(type);",
    "CREATE INDEX IF NOT EXISTS idx_intel_collected_at ON intel(collected_at);",
    "CREATE INDEX IF NOT EXISTS idx_intel_fingerprint ON intel(fingerprint);",
]


class IntelDatabase:
    """SQLite-backed storage for normalized intelligence records.

    Features:
        - Automatic schema creation
        - Deduplication via fingerprint
        - Batch insert support
        - Query by source, type, or keyword
        - PostgreSQL-compatible schema design
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.db_path
        self._ensure_db()

    def _ensure_db(self):
        """Create database and tables if they don't exist."""
        with self._connect() as conn:
            conn.execute(CREATE_TABLE_SQL)
            for idx_sql in CREATE_INDEXES_SQL:
                conn.execute(idx_sql)
            conn.commit()
        logger.info("Database initialized at %s", self.db_path)

    @contextmanager
    def _connect(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        try:
            yield conn
        finally:
            conn.close()

    def insert(self, record: IntelRecord) -> bool:
        """Insert a single record, skipping duplicates.

        Args:
            record: Normalized IntelRecord.

        Returns:
            True if inserted, False if duplicate.
        """
        with self._connect() as conn:
            try:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO intel
                    (source, type, title, content, url, collected_at, metadata, fingerprint)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record.source,
                        record.intel_type,
                        record.title,
                        record.content,
                        record.url,
                        record.collected_at,
                        json.dumps(record.metadata),
                        record.fingerprint,
                    ),
                )
                conn.commit()
                if conn.total_changes > 0:
                    return True
                return False
            except sqlite3.Error as e:
                logger.error("Insert failed: %s", e)
                return False

    def insert_batch(self, records: list[IntelRecord]) -> dict:
        """Insert multiple records in a single transaction.

        Args:
            records: List of IntelRecord instances.

        Returns:
            Dict with 'inserted' and 'duplicates' counts.
        """
        inserted = 0
        duplicates = 0

        with self._connect() as conn:
            for record in records:
                try:
                    cursor = conn.execute(
                        """
                        INSERT OR IGNORE INTO intel
                        (source, type, title, content, url, collected_at, metadata, fingerprint)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            record.source,
                            record.intel_type,
                            record.title,
                            record.content,
                            record.url,
                            record.collected_at,
                            json.dumps(record.metadata),
                            record.fingerprint,
                        ),
                    )
                    if cursor.rowcount > 0:
                        inserted += 1
                    else:
                        duplicates += 1
                except sqlite3.Error as e:
                    logger.error("Batch insert error for record %s: %s", record.fingerprint[:8], e)
                    duplicates += 1

            conn.commit()

        logger.info("Batch insert: %d inserted, %d duplicates skipped", inserted, duplicates)
        return {"inserted": inserted, "duplicates": duplicates}

    def query(
        self,
        source: Optional[str] = None,
        intel_type: Optional[str] = None,
        keyword: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        """Query stored intelligence records.

        Args:
            source: Filter by source (e.g., 'github').
            intel_type: Filter by type (e.g., 'vuln').
            keyword: Search title and content.
            limit: Max results.
            offset: Pagination offset.

        Returns:
            List of record dicts.
        """
        conditions = []
        params = []

        if source:
            conditions.append("source = ?")
            params.append(source)
        if intel_type:
            conditions.append("type = ?")
            params.append(intel_type)
        if keyword:
            conditions.append("(title LIKE ? OR content LIKE ?)")
            params.extend([f"%{keyword}%", f"%{keyword}%"])

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        sql = f"""
            SELECT * FROM intel
            {where}
            ORDER BY collected_at DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])

        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
            results = []
            for row in rows:
                record = dict(row)
                if record.get("metadata"):
                    try:
                        record["metadata"] = json.loads(record["metadata"])
                    except (json.JSONDecodeError, TypeError):
                        pass
                results.append(record)
            return results

    def count(self, source: Optional[str] = None, intel_type: Optional[str] = None) -> int:
        """Count records, optionally filtered.

        Args:
            source: Filter by source.
            intel_type: Filter by type.

        Returns:
            Record count.
        """
        conditions = []
        params = []
        if source:
            conditions.append("source = ?")
            params.append(source)
        if intel_type:
            conditions.append("type = ?")
            params.append(intel_type)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        sql = f"SELECT COUNT(*) FROM intel {where}"

        with self._connect() as conn:
            return conn.execute(sql, params).fetchone()[0]

    def stats(self) -> dict:
        """Get database statistics.

        Returns:
            Dict with total count and per-source/type breakdowns.
        """
        with self._connect() as conn:
            total = conn.execute("SELECT COUNT(*) FROM intel").fetchone()[0]

            source_counts = {}
            for row in conn.execute("SELECT source, COUNT(*) as cnt FROM intel GROUP BY source"):
                source_counts[row["source"]] = row["cnt"]

            type_counts = {}
            for row in conn.execute("SELECT type, COUNT(*) as cnt FROM intel GROUP BY type"):
                type_counts[row["type"]] = row["cnt"]

        return {
            "total_records": total,
            "by_source": source_counts,
            "by_type": type_counts,
        }

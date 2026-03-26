"""
HYDRA INTEL — Intelligence Service Layer

Business logic bridging the API routes to the storage/collector layers.
"""

import json
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

from storage.database import IntelDatabase
from core.logger import get_logger

logger = get_logger("service.intel")


class IntelService:
    """Service layer for intel data operations."""

    def __init__(self, db: IntelDatabase):
        self.db = db

    def get_dashboard_stats(self) -> dict:
        """Aggregate stats for the dashboard overview."""
        stats = self.db.stats()
        recent_24h = self._count_recent(hours=24)
        critical = self._count_by_keyword("critical")

        return {
            "total_records": stats["total_records"],
            "by_source": stats["by_source"],
            "by_type": stats["by_type"],
            "recent_count_24h": recent_24h,
            "critical_count": critical,
        }

    def get_threats(
        self,
        source: Optional[str] = None,
        intel_type: Optional[str] = None,
        keyword: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Get paginated threat intel records."""
        items = self.db.query(
            source=source,
            intel_type=intel_type,
            keyword=keyword,
            limit=limit,
            offset=offset,
        )
        total = self.db.count(source=source, intel_type=intel_type)
        return {"items": items, "total": total}

    def get_threat_by_id(self, threat_id: int) -> Optional[dict]:
        """Get a single threat by ID."""
        with self.db._connect() as conn:
            row = conn.execute("SELECT * FROM intel WHERE id = ?", (threat_id,)).fetchone()
            if row:
                record = dict(row)
                if record.get("metadata"):
                    try:
                        record["metadata"] = json.loads(record["metadata"])
                    except (json.JSONDecodeError, TypeError):
                        pass
                return record
        return None

    def search(self, query: str, types: Optional[list[str]] = None, limit: int = 50) -> list[dict]:
        """Global search across all intel records."""
        conditions = ["(title LIKE ? OR content LIKE ? OR url LIKE ?)"]
        params = [f"%{query}%", f"%{query}%", f"%{query}%"]

        if types:
            placeholders = ",".join("?" * len(types))
            conditions.append(f"type IN ({placeholders})")
            params.extend(types)

        where = "WHERE " + " AND ".join(conditions)

        sql = f"""
            SELECT id, source, type, title, url, collected_at
            FROM intel
            {where}
            ORDER BY collected_at DESC
            LIMIT ?
        """
        params.append(limit)

        with self.db._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]

    def get_trend_data(self, hours: int = 24) -> list[dict]:
        """Get threat count trend data grouped by hour."""
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

        with self.db._connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    strftime('%Y-%m-%dT%H:00:00', collected_at) as hour,
                    COUNT(*) as count
                FROM intel
                WHERE collected_at >= ?
                GROUP BY hour
                ORDER BY hour
                """,
                (cutoff,),
            ).fetchall()
            return [{"timestamp": r["hour"], "count": r["count"]} for r in rows]

    def get_sources_summary(self) -> list[dict]:
        """Get per-source collection summary."""
        with self.db._connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    source,
                    COUNT(*) as total,
                    MAX(collected_at) as last_collected
                FROM intel
                GROUP BY source
                ORDER BY total DESC
                """
            ).fetchall()
            return [dict(r) for r in rows]

    def get_leaks(self, keyword: Optional[str] = None, limit: int = 50, offset: int = 0) -> dict:
        """Get credential leak records (type = 'leak')."""
        return self.get_threats(intel_type="leak", keyword=keyword, limit=limit, offset=offset)

    def get_vulns(self, keyword: Optional[str] = None, limit: int = 50, offset: int = 0) -> dict:
        """Get vulnerability records (type = 'vuln')."""
        return self.get_threats(intel_type="vuln", keyword=keyword, limit=limit, offset=offset)

    def delete_threat(self, threat_id: int) -> bool:
        """Delete a threat record."""
        with self.db._connect() as conn:
            cursor = conn.execute("DELETE FROM intel WHERE id = ?", (threat_id,))
            conn.commit()
            return cursor.rowcount > 0

    def _count_recent(self, hours: int = 24) -> int:
        """Count records from the last N hours."""
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        with self.db._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM intel WHERE collected_at >= ?", (cutoff,)
            ).fetchone()
            return row[0] if row else 0

    def _count_by_keyword(self, keyword: str) -> int:
        """Count records matching a keyword in metadata."""
        with self.db._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM intel WHERE metadata LIKE ?",
                (f"%{keyword}%",),
            ).fetchone()
            return row[0] if row else 0

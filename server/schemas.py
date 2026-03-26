"""
HYDRA INTEL - Pydantic Schemas

Request/response models for the REST API.
"""

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class IntelType(str, Enum):
    leak = "leak"
    vuln = "vuln"
    mention = "mention"
    alert = "alert"
    report = "report"
    paste = "paste"
    code = "code"


class SourceStatus(str, Enum):
    active = "active"
    error = "error"
    paused = "paused"
    pending = "pending"
    running = "running"


class IOCType(str, Enum):
    ip = "ip"
    domain = "domain"
    hash = "hash"
    email = "email"
    url = "url"
    cve = "cve"


class APIResponse(BaseModel):
    success: bool = True
    message: str = "OK"


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.per_page


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    per_page: int
    pages: int


class IntelRecord(BaseModel):
    id: int
    source: str
    type: str
    title: str
    content: Optional[str] = None
    url: Optional[str] = None
    collected_at: str
    metadata: Optional[dict] = None
    fingerprint: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class ThreatFilters(BaseModel):
    source: Optional[str] = None
    type: Optional[str] = None
    severity: Optional[Severity] = None
    keyword: Optional[str] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)


class DashboardStats(BaseModel):
    total_records: int
    by_source: dict[str, int]
    by_type: dict[str, int]
    recent_count_24h: int
    critical_count: int
    sources_active: int
    sources_total: int


class TrendPoint(BaseModel):
    timestamp: str
    count: int


class DashboardTrend(BaseModel):
    period: str
    data: list[TrendPoint]


class CollectorInfo(BaseModel):
    name: str
    source: str
    status: SourceStatus
    last_run: Optional[str] = None
    items_collected: int = 0
    errors: list[str] = []
    enabled: bool = True


class CollectorRunRequest(BaseModel):
    query: Optional[str] = None
    max_results: int = Field(default=50, ge=1, le=500)
    preferred_tool: Optional[str] = None
    use_tool_registry: bool = True
    scan_signatures: bool = True


class CollectorRunResult(BaseModel):
    source: str
    query: str
    collected: int
    inserted: int
    duplicates: int
    errors: list[str]
    elapsed: float
    tool_name: Optional[str] = None
    tools_tried: list[str] = []
    fallback_used: bool = False
    warnings: list[str] = []


class IOCRecord(BaseModel):
    id: Optional[int] = None
    type: IOCType
    value: str
    threat_score: int = Field(default=0, ge=0, le=100)
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    sources: list[str] = []
    tags: list[str] = []
    status: str = "active"
    related_count: int = 0


class IOCCreate(BaseModel):
    type: IOCType
    value: str
    threat_score: int = Field(default=50, ge=0, le=100)
    sources: list[str] = []
    tags: list[str] = []


class LeakRecord(BaseModel):
    id: int
    email: str
    domain: str
    password_hash: str
    hash_type: str
    source: str
    breach_name: str
    date: str
    severity: Severity
    status: str = "new"


class DarkWebAlert(BaseModel):
    id: int
    keyword: str
    category: str
    source: str
    onion_url: str
    snippet: str
    detected_at: str
    is_new: bool = True
    severity: Severity
    mentions: int = 0


class ReportRecord(BaseModel):
    id: int
    title: str
    type: str
    status: str
    date: str
    pages: int
    findings: int
    severity: Severity


class ReportGenerate(BaseModel):
    type: str = "weekly"
    title: Optional[str] = None


class SettingsUpdate(BaseModel):
    key: str
    value: Any


class AppSettings(BaseModel):
    github_token_set: bool
    reddit_configured: bool
    db_type: str
    db_path: str
    max_results: int
    rate_limit: float
    log_level: str
    concurrency_mode: str
    alert_keywords: list[str]
    proxy_configured: bool


class GlobalSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    types: Optional[list[str]] = None
    limit: int = Field(default=50, ge=1, le=200)


class SearchResult(BaseModel):
    id: int
    source: str
    type: str
    title: str
    url: Optional[str] = None
    collected_at: str
    relevance: float = 1.0


class WSEvent(BaseModel):
    event: str
    data: dict

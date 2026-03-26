"""
HYDRA INTEL — Dashboard API Routes

/api/dashboard/*
"""

from fastapi import APIRouter, Depends

from server.dependencies import get_intel_service, get_collector_service
from server.services.intel_service import IntelService
from server.services.collector_service import CollectorService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    service: IntelService = Depends(get_intel_service),
    collectors: CollectorService = Depends(get_collector_service),
):
    """Get aggregated dashboard statistics."""
    stats = service.get_dashboard_stats()
    collector_statuses = collectors.get_all_statuses()
    active = sum(1 for c in collector_statuses if c["status"] == "active")

    return {
        **stats,
        "sources_active": active,
        "sources_total": len(collector_statuses),
    }


@router.get("/trend")
def get_threat_trend(
    hours: int = 24,
    service: IntelService = Depends(get_intel_service),
):
    """Get threat count trend data."""
    data = service.get_trend_data(hours=hours)
    return {"period": f"{hours}h", "data": data}


@router.get("/sources-summary")
def get_sources_summary(service: IntelService = Depends(get_intel_service)):
    """Get collection stats grouped by source."""
    return service.get_sources_summary()

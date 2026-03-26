"""
HYDRA INTEL — Threats API Routes

/api/threats/*
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from server.dependencies import get_intel_service
from server.services.intel_service import IntelService

router = APIRouter(prefix="/api/threats", tags=["Threats"])


@router.get("")
def list_threats(
    source: Optional[str] = Query(None, description="Filter by source"),
    type: Optional[str] = Query(None, description="Filter by intel type"),
    keyword: Optional[str] = Query(None, description="Search keyword"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    service: IntelService = Depends(get_intel_service),
):
    """List threat intel records with filtering and pagination."""
    offset = (page - 1) * per_page
    result = service.get_threats(
        source=source,
        intel_type=type,
        keyword=keyword,
        limit=per_page,
        offset=offset,
    )
    return {
        "items": result["items"],
        "total": result["total"],
        "page": page,
        "per_page": per_page,
        "pages": (result["total"] + per_page - 1) // per_page if per_page else 0,
    }


@router.get("/{threat_id}")
def get_threat(
    threat_id: int,
    service: IntelService = Depends(get_intel_service),
):
    """Get a single threat by ID."""
    threat = service.get_threat_by_id(threat_id)
    if not threat:
        raise HTTPException(status_code=404, detail="Threat not found")
    return threat


@router.delete("/{threat_id}")
def delete_threat(
    threat_id: int,
    service: IntelService = Depends(get_intel_service),
):
    """Delete a threat record."""
    if service.delete_threat(threat_id):
        return {"success": True, "message": f"Threat {threat_id} deleted"}
    raise HTTPException(status_code=404, detail="Threat not found")


@router.get("/type/leaks")
def list_leaks(
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    service: IntelService = Depends(get_intel_service),
):
    """List credential leak records."""
    offset = (page - 1) * per_page
    result = service.get_leaks(keyword=keyword, limit=per_page, offset=offset)
    return {
        "items": result["items"],
        "total": result["total"],
        "page": page,
        "per_page": per_page,
    }


@router.get("/type/vulns")
def list_vulns(
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    service: IntelService = Depends(get_intel_service),
):
    """List vulnerability records."""
    offset = (page - 1) * per_page
    result = service.get_vulns(keyword=keyword, limit=per_page, offset=offset)
    return {
        "items": result["items"],
        "total": result["total"],
        "page": page,
        "per_page": per_page,
    }

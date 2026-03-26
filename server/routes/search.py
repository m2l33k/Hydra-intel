"""
HYDRA INTEL — Global Search API Routes

/api/search
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from server.dependencies import get_intel_service
from server.services.intel_service import IntelService

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("")
def global_search(
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    types: Optional[str] = Query(None, description="Comma-separated intel types to filter"),
    limit: int = Query(50, ge=1, le=200),
    service: IntelService = Depends(get_intel_service),
):
    """Search across all intelligence records.

    Searches title, content, and URL fields.
    Optionally filter by type (e.g., types=leak,vuln).
    """
    type_list = [t.strip() for t in types.split(",")] if types else None
    results = service.search(query=q, types=type_list, limit=limit)
    return {"query": q, "results": results, "count": len(results)}

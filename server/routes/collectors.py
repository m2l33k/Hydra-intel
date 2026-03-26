"""
HYDRA INTEL - Collector Management API Routes

/api/collectors/*
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from server.dependencies import get_collector_service
from server.services.collector_service import CollectorService
from server.schemas import CollectorRunRequest

router = APIRouter(prefix="/api/collectors", tags=["Collectors"])


@router.get("")
def list_collectors(service: CollectorService = Depends(get_collector_service)):
    """Get status of all collectors."""
    return service.get_all_statuses()


@router.get("/tools/status")
def tool_status(service: CollectorService = Depends(get_collector_service)):
    """Get global tool-manager status and health report."""
    return service.get_tool_manager_status()


@router.get("/tools/targets")
def tool_targets(service: CollectorService = Depends(get_collector_service)):
    """List target types with tool counts and best tool."""
    return service.get_tool_targets()


@router.get("/tools")
def list_tools(
    source: Optional[str] = None,
    target_type: Optional[str] = None,
    service: CollectorService = Depends(get_collector_service),
):
    """List tool definitions globally, by source, or by target type."""
    if source:
        tools = service.get_source_tools(source)
        if not tools:
            raise HTTPException(status_code=404, detail=f"Collector '{source}' not found")
        return tools

    if target_type:
        return service.get_tools(target_type)

    return service.get_tools()


@router.get("/{source}")
def get_collector(source: str, service: CollectorService = Depends(get_collector_service)):
    """Get status of a specific collector."""
    status = service.get_status(source)
    if not status:
        raise HTTPException(status_code=404, detail=f"Collector '{source}' not found")
    return status


@router.post("/{source}/run")
def run_collector(
    source: str,
    request: Optional[CollectorRunRequest] = None,
    background: bool = False,
    service: CollectorService = Depends(get_collector_service),
):
    """Run a specific collector.

    Set background=true to run asynchronously.
    """
    query = request.query if request else None
    max_results = request.max_results if request else 50
    preferred_tool = request.preferred_tool if request else None
    use_tool_registry = request.use_tool_registry if request else True
    scan_signatures = request.scan_signatures if request else True

    if background:
        result = service.run_collector_background(
            source,
            query=query,
            max_results=max_results,
            preferred_tool=preferred_tool,
            use_tool_registry=use_tool_registry,
            scan_signatures=scan_signatures,
        )
        return {"success": True, **result}

    result = service.run_collector(
        source,
        query=query,
        max_results=max_results,
        preferred_tool=preferred_tool,
        use_tool_registry=use_tool_registry,
        scan_signatures=scan_signatures,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/run-all")
def run_all_collectors(
    max_results: int = 50,
    use_tool_registry: bool = True,
    scan_signatures: bool = True,
    service: CollectorService = Depends(get_collector_service),
):
    """Run all enabled collectors in background."""
    result = service.run_all_background(
        max_results=max_results,
        use_tool_registry=use_tool_registry,
        scan_signatures=scan_signatures,
    )
    return {"success": True, **result}


@router.patch("/{source}/toggle")
def toggle_collector(
    source: str,
    enabled: bool = True,
    service: CollectorService = Depends(get_collector_service),
):
    """Enable or disable a collector."""
    result = service.toggle_collector(source, enabled)
    if not result:
        raise HTTPException(status_code=404, detail=f"Collector '{source}' not found")
    return result

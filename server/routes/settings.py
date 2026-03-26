"""
HYDRA INTEL — Settings API Routes

/api/settings
"""

from fastapi import APIRouter

from config import settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("")
def get_settings():
    """Get current application settings (safe subset, no secrets)."""
    return {
        "app_name": settings.app_name,
        "app_version": settings.app_version,
        "debug": settings.debug,
        "db_type": settings.db_type,
        "db_path": settings.db_path,
        "max_results": settings.default_max_results,
        "rate_limit": settings.rate_limit_delay,
        "log_level": settings.log_level,
        "concurrency_mode": settings.concurrency_mode,
        "alert_keywords": settings.alert_keywords,
        "github_token_set": bool(settings.github_token),
        "reddit_configured": bool(settings.reddit_client_id),
        "proxy_configured": bool(settings.proxy_url),
        "request_timeout": settings.request_timeout,
        "max_retries": settings.max_retries,
    }


@router.get("/keywords")
def get_alert_keywords():
    """Get the current alert keyword list."""
    return {"keywords": settings.alert_keywords}


@router.post("/keywords")
def update_alert_keywords(keywords: list[str]):
    """Update the alert keyword list (runtime only)."""
    settings.alert_keywords = keywords
    return {"success": True, "keywords": settings.alert_keywords}

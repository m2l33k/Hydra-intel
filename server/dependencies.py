"""
HYDRA INTEL — FastAPI Dependency Injection

Shared service instances for route handlers.
"""

from functools import lru_cache

from storage.database import IntelDatabase
from server.services.intel_service import IntelService
from server.services.collector_service import CollectorService
from config import settings


@lru_cache()
def get_database() -> IntelDatabase:
    """Singleton database instance."""
    db = IntelDatabase(settings.db_path)
    return db


@lru_cache()
def get_intel_service() -> IntelService:
    """Singleton intel service."""
    return IntelService(get_database())


@lru_cache()
def get_collector_service() -> CollectorService:
    """Singleton collector service."""
    return CollectorService(get_database())

"""
HYDRA INTEL — FastAPI Application

Main server entry point. Mounts all routers and configures middleware.
"""

import sys
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure project root is in path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings
from core.logger import get_logger
from server.routes import dashboard, threats, collectors, search, settings as settings_routes, websocket
from server.dependencies import get_database, get_collector_service
from server.routes.websocket import broadcast_threat_event

logger = get_logger("server")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("HYDRA INTEL server starting...")

    # Initialize database
    db = get_database()
    stats = db.stats()
    logger.info("Database ready: %d records", stats["total_records"])

    # Wire collector events to WebSocket broadcast
    collector_svc = get_collector_service()

    def on_threat_event(event: dict):
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(broadcast_threat_event(event))
        except RuntimeError:
            pass

    collector_svc.add_listener(on_threat_event)

    logger.info("HYDRA INTEL server ready")
    yield
    logger.info("HYDRA INTEL server shutting down")


app = FastAPI(
    title="HYDRA INTEL API",
    description="OSINT + DARKINT Threat Intelligence Platform",
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(dashboard.router)
app.include_router(threats.router)
app.include_router(collectors.router)
app.include_router(search.router)
app.include_router(settings_routes.router)
app.include_router(websocket.router)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "server.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )

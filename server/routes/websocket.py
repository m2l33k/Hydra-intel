"""
HYDRA INTEL — WebSocket Routes

/ws/threats — Real-time threat feed
/ws/status  — Real-time collector status
"""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.logger import get_logger

logger = get_logger("ws")

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active.append(websocket)
        logger.info("WebSocket connected. Active: %d", len(self.active))

    def disconnect(self, websocket: WebSocket):
        self.active = [ws for ws in self.active if ws is not websocket]
        logger.info("WebSocket disconnected. Active: %d", len(self.active))

    async def broadcast(self, message: dict):
        """Send message to all connected clients."""
        data = json.dumps(message)
        disconnected = []
        for ws in self.active:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)


# Global connection managers
threat_manager = ConnectionManager()
status_manager = ConnectionManager()


@router.websocket("/ws/threats")
async def ws_threat_feed(websocket: WebSocket):
    """WebSocket endpoint for real-time threat updates.

    Clients receive events when new threats are collected:
    {
        "event": "new_threats",
        "source": "cve",
        "count": 15
    }
    """
    await threat_manager.connect(websocket)
    try:
        while True:
            # Keep alive — listen for client messages (ping/filters)
            data = await websocket.receive_text()
            # Client can send filter preferences
            logger.debug("WS threat received: %s", data)
    except WebSocketDisconnect:
        threat_manager.disconnect(websocket)


@router.websocket("/ws/status")
async def ws_collector_status(websocket: WebSocket):
    """WebSocket endpoint for real-time collector status updates."""
    await status_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        status_manager.disconnect(websocket)


async def broadcast_threat_event(event: dict):
    """Broadcast a threat event to all connected WS clients."""
    await threat_manager.broadcast(event)


async def broadcast_status_event(event: dict):
    """Broadcast a status event to all connected WS clients."""
    await status_manager.broadcast(event)

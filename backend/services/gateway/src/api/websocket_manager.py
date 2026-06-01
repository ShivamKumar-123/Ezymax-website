"""Per-connection WebSocket registry for `/ws/trades/{account_id}`.

CROSS-WORKER FANOUT IS HANDLED BY REDIS — NOT BY THIS DICT.

Every producer of trade-update events (b-book-engine, risk-engine,
trading_service, sltp_engine, copy_engine) publishes to the Redis
channel `account:{account_id}`. The WS handler in `main.py` subscribes
to that channel and relays each message to the connected client. That
design works correctly under `--workers N` because Redis pub/sub
delivers to every subscriber regardless of which gateway process owns
the WS connection.

The dict below only exists so the per-connection `handle_message`
ping/pong path has a place to look up the socket for the current
process. It is NOT a broadcast registry; nothing iterates it.
"""
import json
from typing import Optional
from fastapi import WebSocket


class ConnectionManager:
    _instance: Optional["ConnectionManager"] = None
    _connections: dict[str, WebSocket] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._connections = {}
        return cls._instance

    async def connect(self, account_id: str, websocket: WebSocket):
        self._connections[account_id] = websocket

    def disconnect(self, account_id: str):
        self._connections.pop(account_id, None)

    async def send_to_account(self, account_id: str, data: dict):
        """Per-connection send. Only used for ping/pong replies from the
        same process; for cross-account / cross-worker fanout, publish
        to `account:{account_id}` on Redis instead — see the module
        docstring."""
        ws = self._connections.get(account_id)
        if ws:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                self.disconnect(account_id)

    async def handle_message(self, account_id: str, data: dict):
        msg_type = data.get("type")
        if msg_type == "ping":
            await self.send_to_account(account_id, {"type": "pong"})
        elif msg_type == "subscribe":
            pass

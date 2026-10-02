"""One Redis pub/sub subscriber per process, fanned out in-process.

Why
---
Every WebSocket used to open its OWN Redis pub/sub connection and busy-poll
it (``get_message(timeout=…)`` + ``sleep(0.01)`` loops). With N sockets that
is N pinned Redis connections per worker (the command pool is only 50 wide)
and N JSON parses of every tick. The hub keeps ONE pub/sub connection per
process:

* channels are reference-counted — the first local subscriber triggers a
  ``SUBSCRIBE``, the last one leaving triggers ``UNSUBSCRIBE`` (dynamic
  per-account channels for ``/ws/trades/{account_id}``);
* every message is JSON-parsed once and handed to all local callbacks as
  ``callback(channel, raw, parsed)`` (``parsed`` is None for non-JSON);
* callbacks are plain synchronous functions that must not block — they push
  into a per-socket buffer and set an ``asyncio.Event``; the socket's own
  sender task does the I/O (so one slow client never stalls the hub);
* the listener reconnects with backoff and re-subscribes every live channel.

Subscription changes are applied by the listener task itself between reads
(no concurrent use of the pub/sub connection across tasks), so they take
effect within one read timeout (≤ 0.25 s).
"""
from __future__ import annotations

import asyncio
import contextlib
import itertools
import json
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger("pubsub_hub")

Callback = Callable[[str, Any, Optional[dict]], None]

_READ_TIMEOUT = 0.25


class Subscription:
    __slots__ = ("hub", "channels", "callback", "id")

    def __init__(self, hub: "PubSubHub", channels: tuple[str, ...], callback: Callback, sid: int):
        self.hub = hub
        self.channels = channels
        self.callback = callback
        self.id = sid

    def close(self) -> None:
        self.hub.unsubscribe(self)


class PubSubHub:
    def __init__(self, client_getter: Callable[[], Any] | None = None) -> None:
        self._client_getter = client_getter
        self._subs: dict[str, dict[int, Subscription]] = {}
        self._ids = itertools.count(1)
        self._task: asyncio.Task | None = None
        self._running = False
        self._wake: asyncio.Event | None = None
        self._server_channels: set[str] = set()
        self._dirty = True
        self.messages_dispatched = 0

    # ── lifecycle ────────────────────────────────────────────────────
    def _client(self):
        if self._client_getter is not None:
            return self._client_getter()
        from .redis_client import redis_pubsub_client
        return redis_pubsub_client

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._wake = asyncio.Event()
        self._task = asyncio.create_task(self._listen_loop(), name="pubsub_hub")
        logger.info("pubsub hub started")

    async def stop(self) -> None:
        self._running = False
        if self._wake is not None:
            self._wake.set()
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._task
            self._task = None

    @property
    def running(self) -> bool:
        return self._running

    # ── subscriptions ────────────────────────────────────────────────
    def subscribe(self, channels, callback: Callback) -> Subscription:
        if isinstance(channels, str):
            channels = (channels,)
        chans = tuple(dict.fromkeys(str(c) for c in channels))
        sub = Subscription(self, chans, callback, next(self._ids))
        for ch in chans:
            self._subs.setdefault(ch, {})[sub.id] = sub
        self._poke()
        return sub

    def unsubscribe(self, sub: Subscription) -> None:
        for ch in sub.channels:
            group = self._subs.get(ch)
            if group is None:
                continue
            group.pop(sub.id, None)
            if not group:
                self._subs.pop(ch, None)
        self._poke()

    def local_channels(self) -> set[str]:
        return set(self._subs.keys())

    def _poke(self) -> None:
        self._dirty = True
        if self._wake is not None:
            self._wake.set()

    # ── dispatch ─────────────────────────────────────────────────────
    def dispatch(self, channel: Any, data: Any) -> None:
        """Deliver one message to every local subscriber of ``channel``.
        Public so tests (and in-process publishers) can inject messages."""
        if isinstance(channel, bytes):
            channel = channel.decode("utf-8", "ignore")
        group = self._subs.get(channel)
        if not group:
            return
        parsed = None
        if isinstance(data, (str, bytes)):
            try:
                obj = json.loads(data)
                if isinstance(obj, dict):
                    parsed = obj
            except (ValueError, TypeError):
                parsed = None
        for sub in list(group.values()):
            try:
                sub.callback(channel, data, parsed)
            except Exception as exc:  # one bad consumer never kills the hub
                logger.debug("pubsub hub callback error on %s: %s", channel, exc)
        self.messages_dispatched += 1

    async def _sync_subscriptions(self, ps) -> None:
        self._dirty = False
        wanted = set(self._subs.keys())
        add = wanted - self._server_channels
        drop = self._server_channels - wanted
        if add:
            await ps.subscribe(*sorted(add))
            self._server_channels |= add
        if drop:
            await ps.unsubscribe(*sorted(drop))
            self._server_channels -= drop

    async def _listen_loop(self) -> None:
        backoff = 1.0
        while self._running:
            ps = None
            self._server_channels = set()
            self._dirty = True  # (re)connect: re-subscribe every live channel
            try:
                ps = self._client().pubsub(ignore_subscribe_messages=True)
                backoff = 1.0
                while self._running:
                    if self._wake is not None:
                        self._wake.clear()
                    if self._dirty:
                        await self._sync_subscriptions(ps)
                    if not self._server_channels:
                        # Nothing to listen to — sleep until someone subscribes.
                        with contextlib.suppress(asyncio.TimeoutError):
                            await asyncio.wait_for(self._wake.wait(), timeout=5.0)
                        continue
                    msg = await ps.get_message(ignore_subscribe_messages=True, timeout=_READ_TIMEOUT)
                    # Drain what is already buffered without waiting — bounded so
                    # a firehose can't starve subscription changes or the loop.
                    drained = 0
                    while msg is not None:
                        if msg.get("type") in ("message", "pmessage"):
                            self.dispatch(msg.get("channel"), msg.get("data"))
                        drained += 1
                        if drained >= 256:
                            await asyncio.sleep(0)
                            break
                        msg = await ps.get_message(ignore_subscribe_messages=True, timeout=0)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("pubsub hub error: %s — reconnect in %.0fs", exc, backoff)
                await asyncio.sleep(backoff)
                backoff = min(30.0, backoff * 2)
            finally:
                if ps is not None:
                    with contextlib.suppress(Exception):
                        if self._server_channels:
                            await ps.unsubscribe()
                    with contextlib.suppress(Exception):
                        await ps.aclose()
                self._server_channels = set()


# Process-wide singleton.
hub = PubSubHub()

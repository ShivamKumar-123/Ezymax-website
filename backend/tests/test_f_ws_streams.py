"""End-to-end (in-process) checks of the hub-based WebSocket endpoints:
message formats unchanged, per-symbol coalescing, per-user spread overlay +
config-reload + set_account, bars closed-candle preservation, trade
ping/pong and ordered delivery, admin envelope."""
import asyncio
import json
import unittest
from decimal import Decimal
from uuid import uuid4

from services.gateway.src import main as gw


class _FakeWS:
    def __init__(self, cookie_token=None):
        self.headers = {}
        self.cookies = {"pt_access": cookie_token} if cookie_token else {}
        self.inbox: asyncio.Queue = asyncio.Queue()
        self.sent: list = []
        self.closed = None
        self.accepted = False

    async def accept(self):
        self.accepted = True

    async def close(self, code=1000, reason=""):
        self.closed = (code, reason)

    async def send_text(self, t):
        self.sent.append(t)

    async def send_json(self, d):
        self.sent.append(json.dumps(d))

    async def receive(self):
        return await self.inbox.get()

    def client_says(self, obj):
        self.inbox.put_nowait({"type": "websocket.receive", "text": json.dumps(obj)})

    def disconnect(self):
        self.inbox.put_nowait({"type": "websocket.disconnect"})


class _NoRedis:
    async def eval(self, *a, **k):
        return 1

    async def zrem(self, *a, **k):
        return 1


def _tick(sym, bid, ask, **extra):
    return json.dumps({"symbol": sym, "bid": bid, "ask": ask, **extra})


class WsStreamTests(unittest.TestCase):
    def setUp(self):
        self._orig = (gw.verify_session_token, gw._load_user_spread_overrides, gw.redis_client)
        gw.redis_client = _NoRedis()

    def tearDown(self):
        gw.verify_session_token, gw._load_user_spread_overrides, gw.redis_client = self._orig

    def test_anonymous_price_stream_coalesces_per_symbol(self):
        async def scenario():
            ws = _FakeWS()
            task = asyncio.create_task(gw.price_stream(ws, token=None))
            await asyncio.sleep(0.05)
            gw.pubsub_hub.dispatch("prices", _tick("EURUSD", 1.0, 1.1))
            gw.pubsub_hub.dispatch("prices", _tick("EURUSD", 2.0, 2.1))
            gw.pubsub_hub.dispatch("prices", _tick("XAUUSD", 3.0, 3.1))
            await asyncio.sleep(0.2)
            ws.disconnect()
            await asyncio.wait_for(task, 2)
            return ws

        ws = asyncio.run(scenario())
        self.assertTrue(ws.accepted)
        ticks = [json.loads(t) for t in ws.sent]
        by_sym = {t["symbol"]: t for t in ticks}
        self.assertEqual(by_sym["EURUSD"]["bid"], 2.0)  # newest wins
        self.assertEqual(len([t for t in ticks if t["symbol"] == "EURUSD"]), 1)
        self.assertIn("XAUUSD", by_sym)
        # raw broadcast bytes forwarded untouched for anonymous clients
        self.assertIn(_tick("XAUUSD", 3.0, 3.1), ws.sent)

    def test_user_overlay_reload_and_set_account(self):
        uid = uuid4()
        acct = str(uuid4())
        loads = []

        async def ok(token):
            return {"user_id": uid, "role": "user", "sid": "s"}

        async def fake_load(user_id, trading_account_id=None):
            loads.append(trading_account_id)
            return {"EURUSD": (Decimal("20"), "pips", Decimal("0.0001"), 5)}

        gw.verify_session_token = ok
        gw._load_user_spread_overrides = fake_load

        async def scenario():
            ws = _FakeWS(cookie_token="t")
            task = asyncio.create_task(gw.price_stream(ws, token=None))
            await asyncio.sleep(0.05)
            ws.client_says({"action": "set_account", "account_id": acct})
            await asyncio.sleep(0.1)
            gw.pubsub_hub.dispatch(gw.CONFIG_INSTRUMENTS_RELOAD_CHANNEL, "1")
            await asyncio.sleep(0.1)
            gw.pubsub_hub.dispatch("prices", _tick("EURUSD", 1.1000, 1.1002))
            await asyncio.sleep(0.2)
            ws.disconnect()
            await asyncio.wait_for(task, 2)
            return ws

        ws = asyncio.run(scenario())
        # initial load (no account) → set_account reload → pub/sub reload
        self.assertEqual(loads[0], None)
        self.assertIn(acct, loads[1:])
        self.assertGreaterEqual(len(loads), 3)
        t = json.loads(ws.sent[-1])
        self.assertAlmostEqual(t["ask"] - t["bid"], 0.0020, places=6)  # 20-pip user spread

    def test_bars_closed_candle_not_coalesced(self):
        async def scenario():
            ws = _FakeWS()
            task = asyncio.create_task(gw.bars_stream(ws, token=None))
            await asyncio.sleep(0.05)
            ws.client_says({"type": "subscribe", "symbol": "eurusd", "resolution": "1"})
            await asyncio.sleep(0.05)
            closed = json.dumps({"symbol": "EURUSD", "timeframe": "1m", "time": 60, "closed": True})
            forming = json.dumps({"symbol": "EURUSD", "timeframe": "1m", "time": 120})
            other = json.dumps({"symbol": "EURUSD", "timeframe": "5m", "time": 0})
            gw.pubsub_hub.dispatch(gw.BARS_UPDATES_CHANNEL, closed)
            gw.pubsub_hub.dispatch(gw.BARS_UPDATES_CHANNEL, forming)
            gw.pubsub_hub.dispatch(gw.BARS_UPDATES_CHANNEL, other)  # not subscribed
            await asyncio.sleep(0.2)
            ws.disconnect()
            await asyncio.wait_for(task, 2)
            return ws, closed, forming, other

        ws, closed, forming, other = asyncio.run(scenario())
        self.assertIn(closed, ws.sent)
        self.assertIn(forming, ws.sent)
        self.assertNotIn(other, ws.sent)
        self.assertLess(ws.sent.index(closed), ws.sent.index(forming))

    def test_trade_stream_ordered_events_and_pong(self):
        uid = uuid4()
        acct = uuid4()

        async def ok(token):
            return {"user_id": uid, "role": "user", "sid": "s"}

        class _Res:
            def scalar_one_or_none(self):
                return object()

        class _DB:
            async def execute(self, *a, **k):
                return _Res()

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

        orig_session = gw.AsyncSessionLocal
        gw.AsyncSessionLocal = lambda: _DB()
        gw.verify_session_token = ok
        try:
            async def scenario():
                ws = _FakeWS(cookie_token="t")
                task = asyncio.create_task(gw.trade_stream(ws, str(acct), token=None))
                await asyncio.sleep(0.05)
                for i in range(5):
                    gw.pubsub_hub.dispatch(f"account:{acct}", json.dumps({"type": "e", "i": i}))
                ws.client_says({"type": "ping"})
                await asyncio.sleep(0.1)
                ws.disconnect()
                await asyncio.wait_for(task, 2)
                return ws

            ws = asyncio.run(scenario())
        finally:
            gw.AsyncSessionLocal = orig_session
        events = [json.loads(t) for t in ws.sent]
        self.assertEqual([e["i"] for e in events if e.get("type") == "e"], [0, 1, 2, 3, 4])
        self.assertIn({"type": "pong"}, events)
        # account channel unsubscribed once the socket is gone
        self.assertNotIn(f"account:{acct}", gw.pubsub_hub.local_channels())

    def test_admin_stream_envelope(self):
        import jwt as _jwt
        st = gw.get_settings()
        tok = _jwt.encode({"type": "admin", "admin_id": str(uuid4()), "role": "admin"},
                          st.ADMIN_JWT_SECRET, algorithm=st.ADMIN_JWT_ALGORITHM)

        async def scenario():
            ws = _FakeWS()
            ws.cookies = {"fx_admin": tok}
            task = asyncio.create_task(gw.admin_stream(ws, token=None))
            await asyncio.sleep(0.05)
            gw.pubsub_hub.dispatch("admin:alerts", '{"x":1}')
            await asyncio.sleep(0.1)
            ws.disconnect()
            await asyncio.wait_for(task, 2)
            return ws

        ws = asyncio.run(scenario())
        self.assertEqual(json.loads(ws.sent[0]), {"channel": "admin:alerts", "data": '{"x":1}'})


if __name__ == "__main__":
    unittest.main()

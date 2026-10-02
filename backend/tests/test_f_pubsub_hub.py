"""Section F5: one pub/sub subscriber per process — ref-counted channels,
messages parsed once and fanned out, per-user spread overlay preserved, slow
consumers detected."""
import asyncio
import json
import unittest
from decimal import Decimal

from packages.common.src.pubsub_hub import PubSubHub
from services.gateway.src import main as gw


class HubDispatchTests(unittest.TestCase):
    def test_refcounted_subscriptions(self):
        hub = PubSubHub(client_getter=lambda: None)
        a = hub.subscribe("account:1", lambda *a: None)
        b = hub.subscribe("account:1", lambda *a: None)
        self.assertEqual(hub.local_channels(), {"account:1"})
        a.close()
        self.assertEqual(hub.local_channels(), {"account:1"})  # still one listener
        b.close()
        self.assertEqual(hub.local_channels(), set())          # → UNSUBSCRIBE

    def test_message_parsed_once_and_fanned_out(self):
        hub = PubSubHub(client_getter=lambda: None)
        got = []
        hub.subscribe("prices", lambda ch, raw, parsed: got.append(("a", parsed)))
        hub.subscribe("prices", lambda ch, raw, parsed: got.append(("b", parsed)))
        calls = {"n": 0}
        orig = json.loads

        def counting_loads(*a, **k):
            calls["n"] += 1
            return orig(*a, **k)

        import packages.common.src.pubsub_hub as mod
        mod.json.loads = counting_loads
        try:
            hub.dispatch("prices", json.dumps({"symbol": "EURUSD", "bid": 1, "ask": 2}))
        finally:
            mod.json.loads = orig
        self.assertEqual(calls["n"], 1)
        self.assertEqual([g[0] for g in got], ["a", "b"])
        self.assertEqual(got[0][1]["symbol"], "EURUSD")

    def test_bad_callback_does_not_break_others(self):
        hub = PubSubHub(client_getter=lambda: None)
        got = []

        def boom(*a):
            raise RuntimeError("x")

        hub.subscribe("c", boom)
        hub.subscribe("c", lambda ch, raw, p: got.append(raw))
        hub.dispatch("c", "not-json")
        self.assertEqual(got, ["not-json"])

    def test_listener_syncs_subscribe_and_unsubscribe(self):
        class _PS:
            def __init__(self):
                self.subs = set()
                self.log = []

            async def subscribe(self, *chs):
                self.subs |= set(chs)
                self.log.append(("sub", chs))

            async def unsubscribe(self, *chs):
                self.subs -= set(chs)
                self.log.append(("unsub", chs))

        hub = PubSubHub(client_getter=lambda: None)
        ps = _PS()
        s1 = hub.subscribe("account:9", lambda *a: None)
        asyncio.run(hub._sync_subscriptions(ps))
        self.assertEqual(ps.subs, {"account:9"})
        s1.close()
        asyncio.run(hub._sync_subscriptions(ps))
        self.assertEqual(ps.subs, set())


class HubListenLoopTests(unittest.TestCase):
    def test_listener_end_to_end_with_dynamic_subscribe(self):
        class _PS:
            def __init__(self):
                self.subs = set()
                self.q: asyncio.Queue = asyncio.Queue()

            async def subscribe(self, *chs):
                self.subs |= set(chs)

            async def unsubscribe(self, *chs):
                self.subs -= set(chs) if chs else set(self.subs)

            async def get_message(self, ignore_subscribe_messages=True, timeout=0.0):
                try:
                    return await asyncio.wait_for(self.q.get(), timeout=max(timeout, 0.001))
                except asyncio.TimeoutError:
                    return None

            async def aclose(self):
                pass

        ps = _PS()

        class _Client:
            def pubsub(self, **k):
                return ps

        async def scenario():
            hub = PubSubHub(client_getter=lambda: _Client())
            got = []
            await hub.start()
            hub.subscribe("prices", lambda ch, raw, p: got.append((ch, p["symbol"])))
            await asyncio.sleep(0.05)
            self.assertIn("prices", ps.subs)
            ps.q.put_nowait({"type": "message", "channel": "prices", "data": '{"symbol":"X"}'})
            await asyncio.sleep(0.05)
            acct = hub.subscribe("account:7", lambda ch, raw, p: got.append((ch, raw)))
            await asyncio.sleep(0.3)  # applied within one read timeout
            self.assertIn("account:7", ps.subs)
            ps.q.put_nowait({"type": "message", "channel": "account:7", "data": "evt"})
            await asyncio.sleep(0.05)
            acct.close()
            await asyncio.sleep(0.3)
            self.assertNotIn("account:7", ps.subs)
            await hub.stop()
            return got

        got = asyncio.run(scenario())
        self.assertEqual(got, [("prices", "X"), ("account:7", "evt")])


class PriceOverlayTests(unittest.TestCase):
    def test_overlay_only_for_overridden_symbols(self):
        raw = json.dumps({"symbol": "EURUSD", "bid": 1.1000, "ask": 1.1002})
        # No override for this symbol → exact broadcast bytes forwarded.
        self.assertIs(gw._price_tick_for_client(raw, "EURUSD", {"XAUUSD": ()}), raw)
        self.assertIs(gw._price_tick_for_client(raw, "EURUSD", {}), raw)
        ov = {"EURUSD": (Decimal("10"), "pips", Decimal("0.0001"), 5)}
        out = json.loads(gw._price_tick_for_client(raw, "EURUSD", ov))
        self.assertAlmostEqual(out["ask"] - out["bid"], 0.0010, places=6)  # 10 pips
        self.assertAlmostEqual((out["ask"] + out["bid"]) / 2, 1.1001, places=6)  # mid kept


class SlowConsumerTests(unittest.TestCase):
    def test_queue_overflow_flags_slow_consumer(self):
        async def scenario():
            st = gw._QueueSocketState()
            for i in range(gw._WS_SEND_QUEUE_MAX + 1):
                st.push(str(i))
            return st

        st = asyncio.run(scenario())
        self.assertTrue(st.overflow)
        self.assertEqual(len(st.queue), gw._WS_SEND_QUEUE_MAX)

    def test_queue_sender_raises_slow_consumer(self):
        class _WS:
            async def send_text(self, t):
                pass

            async def send_json(self, d):
                pass

        async def scenario():
            st = gw._QueueSocketState()
            st.overflow = True
            st.event.set()
            await gw._queue_sender(_WS(), st, None, None)

        with self.assertRaises(gw._SlowConsumer):
            asyncio.run(scenario())


if __name__ == "__main__":
    unittest.main()

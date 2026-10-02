"""Section F3 + F9: Redis-authoritative sliding window (local only on Redis
error), atomic INCR+TTL, price-cache staleness fallback, settings_store
negative caching, TTLCache single-flight, publish_price pipelining +
ticks:latest, read-time SL/TP label (no UPDATE on the history read path),
User collections no longer eagerly loaded."""
import asyncio
import json
import time
import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from packages.common.src import rate_limit as rl
from packages.common.src import redis_client as rc


class _WindowRedis:
    """Python model of the sliding-window + incr Lua scripts."""

    def __init__(self, fail=False):
        self.z: dict = {}
        self.kv: dict = {}
        self.ttl: dict = {}
        self.fail = fail

    async def eval(self, script, numkeys, *args):
        if self.fail:
            raise ConnectionError("down")
        key, argv = args[0], args[numkeys:]
        if script == rl._SLIDING_WINDOW_LUA:
            now, window, limit = int(argv[0]), int(argv[1]), int(argv[2])
            zs = [s for s in self.z.get(key, []) if s > now - window]
            if len(zs) >= limit:
                self.z[key] = zs
                return [0, len(zs), 1]
            zs.append(now)
            self.z[key] = zs
            return [1, len(zs), 0]
        if script == rl._INCR_TTL_LUA:
            self.kv[key] = self.kv.get(key, 0) + 1
            if self.kv[key] == 1:
                self.ttl[key] = int(argv[0])
            return self.kv[key]
        raise AssertionError("unexpected script")


def _req(ip="9.9.9.9"):
    return SimpleNamespace(headers={}, client=SimpleNamespace(host=ip))


class RateLimitTests(unittest.TestCase):
    def setUp(self):
        self._orig = rc.redis_client
        rl._LOCAL_RATE_BUCKETS.clear()

    def tearDown(self):
        rc.redis_client = self._orig
        rl._LOCAL_RATE_BUCKETS.clear()

    def test_redis_window_is_authoritative_across_processes(self):
        fake = _WindowRedis()
        rc.redis_client = fake

        async def go():
            for _ in range(3):
                await rl.rate_limit_http_async(_req(), "b", 3, 60)
            # Simulate a different worker: its local bucket is empty, but
            # Redis already holds 3 hits → denied.
            rl._LOCAL_RATE_BUCKETS.clear()
            await rl.rate_limit_http_async(_req(), "b", 3, 60)

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(go())
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Retry-After", ctx.exception.headers)

    def test_local_fallback_only_on_redis_error(self):
        rc.redis_client = _WindowRedis(fail=True)

        async def go():
            for _ in range(2):
                await rl.rate_limit_http_async(_req("1.1.1.1"), "c", 2, 60)
            await rl.rate_limit_http_async(_req("1.1.1.1"), "c", 2, 60)

        with self.assertRaises(HTTPException):
            asyncio.run(go())

    def test_incr_with_ttl_sets_ttl_once(self):
        fake = _WindowRedis()
        rc.redis_client = fake

        async def go():
            return [await rl.incr_with_ttl("otp:x", 600) for _ in range(3)]

        self.assertEqual(asyncio.run(go()), [1, 2, 3])
        self.assertEqual(fake.ttl["otp:x"], 600)

    def test_sync_variant_still_enforces_locally(self):
        rc.redis_client = _WindowRedis(fail=True)

        async def go():
            for _ in range(2):
                rl.rate_limit_http(_req("2.2.2.2"), "d", 2, 60)
            rl.rate_limit_http(_req("2.2.2.2"), "d", 2, 60)

        with self.assertRaises(HTTPException):
            asyncio.run(go())


class _KV:
    def __init__(self, data):
        self.data = dict(data)
        self.gets = 0

    async def get(self, k):
        self.gets += 1
        return self.data.get(k)


class PriceCacheStalenessTests(unittest.TestCase):
    def test_stale_entry_rereads_redis(self):
        from packages.common.src import price_cache as pcm
        orig = pcm.redis_client
        fresh = json.dumps({"symbol": "EURUSD", "bid": 2, "ask": 2})
        pcm.redis_client = _KV({"tick:EURUSD": fresh})
        try:
            cache = pcm.PriceCache()
            cache.ingest("EURUSD", json.dumps({"symbol": "EURUSD", "bid": 1, "ask": 1}))
            # Fresh entry: served from memory, no Redis call.
            self.assertIn('"bid": 1', asyncio.run(cache.get("EURUSD")))
            self.assertEqual(pcm.redis_client.gets, 0)
            # Age it past PRICE_CACHE_STALE_SEC (listener stalled).
            raw, _ = cache._entries["EURUSD"]
            cache._entries["EURUSD"] = (raw, time.monotonic() - 3600)
            self.assertEqual(asyncio.run(cache.get("EURUSD")), fresh)
            self.assertEqual(pcm.redis_client.gets, 1)
        finally:
            pcm.redis_client = orig


class SettingsNegativeCacheTests(unittest.TestCase):
    def test_missing_key_hits_db_once(self):
        from packages.common.src import settings_store as ss
        from packages.common.src import database as dbm

        class _R:
            def __init__(self):
                self.h = {}

            async def hget(self, k, f):
                return self.h.get(f)

            async def hset(self, k, f, v):
                self.h[f] = v

            async def expire(self, *a):
                return True

        calls = {"n": 0}

        class _Res:
            def scalar_one_or_none(self):
                return None

        class _S:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def execute(self, *a, **k):
                calls["n"] += 1
                return _Res()

        orig_r, orig_s = ss.redis_client, dbm.AsyncSessionLocal
        ss.redis_client = _R()
        dbm.AsyncSessionLocal = lambda: _S()
        ss.bust_local_cache()
        try:
            for _ in range(5):
                self.assertEqual(asyncio.run(ss.get_system_setting("nope", "dflt")), "dflt")
            self.assertEqual(calls["n"], 1)
            ss.bust_local_cache()  # in-process bust → still negative-cached in Redis
            self.assertEqual(asyncio.run(ss.get_system_setting("nope", 7)), 7)
            self.assertEqual(calls["n"], 1)
        finally:
            ss.redis_client, dbm.AsyncSessionLocal = orig_r, orig_s
            ss.bust_local_cache()


class TTLCacheTests(unittest.TestCase):
    def test_single_flight_and_ttl(self):
        from packages.common.src.cache import TTLCache
        c = TTLCache("t_f_test", ttl=60)
        calls = {"n": 0}

        async def loader():
            calls["n"] += 1
            await asyncio.sleep(0.01)
            return [1, 2]

        async def go():
            return await asyncio.gather(*(c.get_or_load("k", loader) for _ in range(10)))

        res = asyncio.run(go())
        self.assertEqual(calls["n"], 1)
        self.assertTrue(all(r == [1, 2] for r in res))
        c.invalidate()
        asyncio.run(c.get_or_load("k", loader))
        self.assertEqual(calls["n"], 2)


class _Pipe:
    def __init__(self, log):
        self.log = log

    def __getattr__(self, name):
        def _cmd(*a, **k):
            self.log.append((name, a))
            return self
        return _cmd

    async def execute(self):
        self.log.append(("execute", ()))
        return []


class PublishPipelineTests(unittest.TestCase):
    def test_publish_is_one_round_trip_and_updates_hash(self):
        log = []

        class _R:
            def pipeline(self, transaction=True):
                return _Pipe(log)

        orig = rc.redis_client
        rc.redis_client = _R()
        try:
            asyncio.run(rc.publish_price("eurusd", 1.0, 1.1, "t"))
        finally:
            rc.redis_client = orig
        names = [n for n, _ in log]
        self.assertEqual(names.count("execute"), 1)
        self.assertIn(("hset", (rc.TICKS_LATEST_HASH, "EURUSD")), [(n, a[:2]) for n, a in log])
        self.assertEqual(names.count("publish"), 2)

    def test_get_latest_ticks_reads_hash(self):
        class _R:
            async def hgetall(self, k):
                assert k == rc.TICKS_LATEST_HASH
                return {"EURUSD": "{}"}

            def scan_iter(self, *a, **k):  # must not be used when hash is populated
                raise AssertionError("SCAN on the hot path")

        orig = rc.redis_client
        rc.redis_client = _R()
        try:
            self.assertEqual(asyncio.run(rc.get_latest_ticks()), {"EURUSD": "{}"})
        finally:
            rc.redis_client = orig


class DisplayCloseReasonTests(unittest.TestCase):
    def test_read_time_relabel_matches_old_update(self):
        from services.gateway.src.services.portfolio_service import _display_close_reason as d
        self.assertEqual(d("manual", "buy", 1.0, 1.1, None), "sl")
        self.assertEqual(d("manual", "sell", 1.4, None, 1.5), "tp")
        self.assertEqual(d("manual", "sell", 2.0, None, 1.5), "manual")
        self.assertEqual(d("copy_close", "buy", 1.2, 1.1, 1.3), "copy_close")
        self.assertEqual(d("admin", "buy", 1.0, 1.1, None), "admin")  # never relabelled
        self.assertEqual(d("manual", "buy", 1.0, None, None), "manual")


class UserRelationshipTests(unittest.TestCase):
    def test_user_collections_not_eager(self):
        from packages.common.src.models import User
        for rel in ("accounts", "refresh_tokens", "password_reset_tokens"):
            self.assertEqual(User.__mapper__.relationships[rel].lazy, "raise_on_sql")


if __name__ == "__main__":
    unittest.main()

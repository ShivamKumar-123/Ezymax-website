"""WebSocket handshake auth now uses the session-checked verifier (revoked /
sid-less / hand-off tokens are refused with 4001), and the per-user socket cap
is cluster-wide via Redis leases with a local fallback (Section F4)."""
import asyncio
import unittest
from uuid import uuid4

from services.gateway.src import main as gw


class _FakeWS:
    def __init__(self, cookie_token=None, origin=None):
        self.headers = {"origin": origin} if origin else {}
        self.cookies = {"pt_access": cookie_token} if cookie_token else {}
        self.closed = None
        self.accepted = False

    async def close(self, code=1000, reason=""):
        self.closed = (code, reason)

    async def accept(self):
        self.accepted = True


class WsAuthTests(unittest.TestCase):
    def setUp(self):
        self._orig = gw.verify_session_token

    def tearDown(self):
        gw.verify_session_token = self._orig

    def test_verify_maps_session_checked_user(self):
        uid = uuid4()

        async def ok(token):
            return {"user_id": uid, "role": "user", "amr": ["pwd"], "sid": "s1"}

        gw.verify_session_token = ok
        out = asyncio.run(gw._verify_ws_token("tok"))
        self.assertEqual(out["user_id"], uid)
        self.assertEqual(out["sid"], "s1")

    def test_revoked_or_sidless_token_rejected(self):
        async def reject(token):
            return None

        gw.verify_session_token = reject
        self.assertIsNone(asyncio.run(gw._verify_ws_token("revoked")))
        self.assertIsNone(asyncio.run(gw._verify_ws_token(None)))

    def test_price_stream_closes_4001_on_revoked_session(self):
        async def reject(token):
            return None

        gw.verify_session_token = reject
        ws = _FakeWS(cookie_token="revoked-session-token")
        asyncio.run(gw.price_stream(ws, token=None))
        self.assertEqual(ws.closed[0], 4001)
        self.assertFalse(ws.accepted)

    def test_trade_stream_closes_4001_on_revoked_session(self):
        async def reject(token):
            return None

        gw.verify_session_token = reject
        ws = _FakeWS(cookie_token="revoked")
        asyncio.run(gw.trade_stream(ws, str(uuid4()), token=None))
        self.assertEqual(ws.closed[0], 4001)

    def test_bars_stream_closes_4001_on_revoked_session(self):
        async def reject(token):
            return None

        gw.verify_session_token = reject
        ws = _FakeWS(cookie_token="revoked")
        asyncio.run(gw.bars_stream(ws, token=None))
        self.assertEqual(ws.closed[0], 4001)


class _LeaseRedis:
    """Python model of the lease Lua scripts (shared across 'processes')."""

    def __init__(self, fail=False):
        self.z: dict = {}
        self.fail = fail

    async def eval(self, script, numkeys, *args):
        if self.fail:
            raise ConnectionError("down")
        key = args[0]
        argv = args[numkeys:]
        zs = self.z.setdefault(key, {})
        if script == gw._WS_LEASE_ACQUIRE_LUA:
            now, ttl, mx, member = int(argv[0]), int(argv[1]), int(argv[2]), argv[3]
            for m in [m for m, exp in zs.items() if exp <= now]:
                del zs[m]
            if len(zs) >= mx:
                return 0
            zs[member] = now + ttl
            return 1
        if script == gw._WS_LEASE_RENEW_LUA:
            now, ttl, member = int(argv[0]), int(argv[1]), argv[2]
            if member in zs:
                zs[member] = now + ttl
                return 1
            return 0
        raise AssertionError("unexpected script")

    async def zrem(self, key, member):
        self.z.get(key, {}).pop(member, None)


class WsLeaseTests(unittest.TestCase):
    def setUp(self):
        self._orig = gw.redis_client
        gw._ws_user_conn_counts.clear()

    def tearDown(self):
        gw.redis_client = self._orig
        gw._ws_user_conn_counts.clear()

    def test_cap_is_cluster_wide(self):
        gw.redis_client = _LeaseRedis()
        uid = "u-1"
        leases = []
        for _ in range(gw._WS_MAX_PER_USER):
            ok, lease = asyncio.run(gw._ws_lease_acquire(uid))
            self.assertTrue(ok)
            self.assertEqual(lease[0], "redis")
            leases.append(lease)
        # Over the cap regardless of which process / worker asks.
        self.assertFalse(asyncio.run(gw._ws_lease_acquire(uid))[0])
        asyncio.run(gw._ws_lease_release(uid, leases[0]))
        self.assertTrue(asyncio.run(gw._ws_lease_acquire(uid))[0])

    def test_anonymous_never_capped(self):
        gw.redis_client = _LeaseRedis()
        for _ in range(gw._WS_MAX_PER_USER * 2):
            self.assertEqual(asyncio.run(gw._ws_lease_acquire(None)), (True, None))

    def test_redis_down_falls_back_to_local_cap(self):
        gw.redis_client = _LeaseRedis(fail=True)
        uid = "u-2"
        for _ in range(gw._WS_MAX_PER_USER):
            ok, lease = asyncio.run(gw._ws_lease_acquire(uid))
            self.assertTrue(ok)
            self.assertEqual(lease, ("local", None))
        self.assertFalse(asyncio.run(gw._ws_lease_acquire(uid))[0])
        asyncio.run(gw._ws_lease_release(uid, ("local", None)))
        self.assertTrue(asyncio.run(gw._ws_lease_acquire(uid))[0])


if __name__ == "__main__":
    unittest.main()

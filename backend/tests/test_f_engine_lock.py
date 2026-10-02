"""Section F6: engine_lock v2 — one leader across processes, sticky
leadership, fencing counter, in-process double-run guard, fail-closed."""
import asyncio
import unittest

from packages.common.src import engine_lock as el
from packages.common.src import redis_client as rc


class _FakeRedis:
    """Implements the three engine_lock Lua scripts in Python."""

    def __init__(self, fail=False):
        self.kv: dict = {}
        self.fail = fail

    async def eval(self, script, numkeys, *args):
        if self.fail:
            raise ConnectionError("redis down")
        keys, argv = args[:numkeys], args[numkeys:]
        if script == el._ACQUIRE_LUA:
            lock, fence = keys
            token = argv[0]
            cur = self.kv.get(lock)
            if cur == token:
                return [2, int(self.kv.get(fence, 0))]
            if cur is not None:
                return [0, 0]
            self.kv[lock] = token
            self.kv[fence] = int(self.kv.get(fence, 0)) + 1
            return [1, self.kv[fence]]
        if script == el._RENEW_LUA:
            return 1 if self.kv.get(keys[0]) == argv[0] else 0
        if script == el._RELEASE_LUA:
            if self.kv.get(keys[0]) == argv[0]:
                del self.kv[keys[0]]
                return 1
            return 0
        raise AssertionError("unexpected script")


class EngineLockV2Tests(unittest.TestCase):
    def setUp(self):
        self._orig_client = rc.redis_client
        self._orig_token = el._PROCESS_TOKEN
        self.fake = _FakeRedis()
        rc.redis_client = self.fake
        el._held.clear()
        el._active.clear()

    def tearDown(self):
        rc.redis_client = self._orig_client
        el._PROCESS_TOKEN = self._orig_token
        el._held.clear()
        el._active.clear()

    async def _tick(self, name="eng", token=None):
        if token is not None:
            el._PROCESS_TOKEN = token
        async with el.engine_lock(name, ttl_seconds=10) as lease:
            return bool(lease), lease.fence

    def test_only_one_process_leads(self):
        a = asyncio.run(self._tick(token="proc-A"))
        b = asyncio.run(self._tick(token="proc-B"))
        self.assertTrue(a[0])
        self.assertFalse(b[0])

    def test_leadership_is_sticky_and_fence_stable(self):
        first = asyncio.run(self._tick(token="proc-A"))
        second = asyncio.run(self._tick(token="proc-A"))  # next tick, same process
        self.assertTrue(first[0] and second[0])
        self.assertEqual(first[1], second[1])  # renewal keeps the same fence
        self.assertEqual(self.fake.kv["engine_lock:eng"], "proc-A")  # not released

    def test_fence_increments_on_new_leader(self):
        a = asyncio.run(self._tick(token="proc-A"))
        el._PROCESS_TOKEN = "proc-A"
        asyncio.run(el.release_all())
        b = asyncio.run(self._tick(token="proc-B"))
        self.assertTrue(b[0])
        self.assertEqual(b[1], a[1] + 1)

    def test_release_all_hands_over(self):
        asyncio.run(self._tick(token="proc-A"))
        el._PROCESS_TOKEN = "proc-A"
        asyncio.run(el.release_all())
        self.assertNotIn("engine_lock:eng", self.fake.kv)
        self.assertTrue(asyncio.run(self._tick(token="proc-B"))[0])

    def test_same_process_cannot_double_run(self):
        el._PROCESS_TOKEN = "proc-A"

        async def scenario():
            async with el.engine_lock("eng", ttl_seconds=10) as outer:
                async with el.engine_lock("eng", ttl_seconds=10) as inner:
                    return bool(outer), bool(inner)

        outer, inner = asyncio.run(scenario())
        self.assertTrue(outer)
        self.assertFalse(inner)

    def test_redis_down_fails_closed(self):
        self.fake.fail = True
        self.assertFalse(asyncio.run(self._tick(token="proc-A"))[0])


if __name__ == "__main__":
    unittest.main()

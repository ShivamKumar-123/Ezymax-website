"""Section F8: Idempotency-Key is claim-first — the first request claims the
key (committed in its own session) BEFORE running the handler; a concurrent
duplicate gets 409; a finished one is replayed; an abandoned claim is taken
over."""
import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from packages.common.src import idempotency as idem


class _Row:
    def __init__(self, vals):
        self._v = vals

    def first(self):
        return self._v


class _Store:
    """Shared 'table' + session factory modelling the SQL statements."""

    def __init__(self):
        self.rows: dict = {}   # (scope, key_hash) -> {"status", "body", "stale"}
        self.commits = 0

    def factory(self):
        store = self

        class _S:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def execute(self, stmt, params):
                sql = str(stmt)
                k = (params["scope"], params["key_hash"])
                if "ON CONFLICT (scope, key_hash) DO NOTHING\n    RETURNING id" in sql:
                    if k in store.rows:
                        return _Row(None)
                    store.rows[k] = {"status": 0, "body": "", "stale": False}
                    return _Row(("id",))
                if "SET created_at = now()" in sql:
                    r = store.rows.get(k)
                    if r and r["status"] == 0 and r["stale"]:
                        r["stale"] = False
                        return _Row(("id",))
                    return _Row(None)
                if sql.strip().startswith("SELECT response_status"):
                    r = store.rows.get(k)
                    return _Row((r["status"], r["body"]) if r else None)
                if "SET response_status = :status" in sql:
                    r = store.rows.get(k)
                    if not r:
                        return _Row(None)
                    r["status"], r["body"] = params["status"], params["body"]
                    return _Row(("id",))
                if sql.strip().startswith("DELETE FROM idempotency_keys"):
                    r = store.rows.get(k)
                    if r and r["status"] == 0:
                        del store.rows[k]
                    return _Row(None)
                if "INSERT INTO idempotency_keys" in sql:
                    store.rows.setdefault(k, {"status": params["status"], "body": params["body"], "stale": False})
                    return _Row(None)
                raise AssertionError(sql)

            async def commit(self):
                store.commits += 1

        return _S()


def _req(key="abcdefgh-1234"):
    return SimpleNamespace(headers={"Idempotency-Key": key})


class IdempotencyClaimTests(unittest.TestCase):
    def setUp(self):
        self._orig = idem._session_factory
        self.store = _Store()
        idem._session_factory = lambda: self.store.factory
        self.uid = uuid4()

    def tearDown(self):
        idem._session_factory = self._orig

    def _get(self, key="abcdefgh-1234"):
        return asyncio.run(idem.get_cached_response(_req(key), scope="s", user_id=self.uid))

    def test_first_request_claims_and_proceeds(self):
        self.assertIsNone(self._get())
        self.assertEqual(len(self.store.rows), 1)
        self.assertGreaterEqual(self.store.commits, 1)  # claim committed before handler

    def test_concurrent_duplicate_gets_409(self):
        self.assertIsNone(self._get())
        with self.assertRaises(HTTPException) as ctx:
            self._get()
        self.assertEqual(ctx.exception.status_code, 409)

    def test_finished_duplicate_is_replayed(self):
        self.assertIsNone(self._get())
        asyncio.run(idem.store_response(_req(), scope="s", user_id=self.uid,
                                        response_json={"ok": 1}, status_code=201))
        resp = self._get()
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.headers.get("Idempotency-Replay"), "true")
        self.assertIn(b'"ok"', resp.body)

    def test_released_claim_allows_retry(self):
        self.assertIsNone(self._get())
        asyncio.run(idem.release_claim(_req(), scope="s", user_id=self.uid))
        self.assertIsNone(self._get())

    def test_abandoned_claim_taken_over(self):
        self.assertIsNone(self._get())
        next(iter(self.store.rows.values()))["stale"] = True
        self.assertIsNone(self._get())

    def test_no_header_is_noop(self):
        r = asyncio.run(idem.get_cached_response(
            SimpleNamespace(headers={}), scope="s", user_id=self.uid))
        self.assertIsNone(r)
        self.assertEqual(self.store.rows, {})


if __name__ == "__main__":
    unittest.main()

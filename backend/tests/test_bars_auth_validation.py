"""H-TRADE-7: GET /instruments/{symbol}/bars must be per-user rate-limited and
must 404 on a symbol not in the instrument table before any external fetch.
"""
import asyncio
import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from services.gateway.src.api import instruments


class _Res:
    def __init__(self, first_val):
        self._first = first_val

    def first(self):
        return self._first


class _DB:
    def __init__(self, instrument_exists):
        self._exists = instrument_exists

    async def execute(self, *a, **k):
        return _Res(("id",) if self._exists else None)


class BarsAuthValidationTests(unittest.TestCase):
    def setUp(self):
        self._calls = []
        self._orig = instruments.rate_limit_http
        instruments.rate_limit_http = lambda *a, **k: self._calls.append(a)

    def tearDown(self):
        instruments.rate_limit_http = self._orig

    def _call(self, exists):
        req = SimpleNamespace(headers={}, client=SimpleNamespace(host="1.2.3.4"))
        return instruments.get_bars(
            "FAKESYM", req, resolution="5", live=1,
            current_user={"user_id": "u1"}, db=_DB(exists),
        )

    def test_unknown_symbol_404(self):
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(self._call(exists=False))
        self.assertEqual(ctx.exception.status_code, 404)

    def test_rate_limit_called_per_user(self):
        try:
            asyncio.run(self._call(exists=False))
        except HTTPException:
            pass
        # bucket string includes the user id (per-user limiting).
        self.assertTrue(self._calls)
        self.assertIn("u1", self._calls[0][1])


if __name__ == "__main__":
    unittest.main()

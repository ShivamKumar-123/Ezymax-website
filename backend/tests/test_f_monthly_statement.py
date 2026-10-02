"""Section F8: monthly statements — durable per-user claim committed before
any email is sent; only users this process claimed are emailed; a failed send
releases its claim; users already emailed by the legacy Redis-key version are
not emailed twice."""
import asyncio
import sys
import types
import unittest
from uuid import uuid4

from services.gateway.src.engines import monthly_statement_engine as mse


class _Res:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _Session:
    def __init__(self, world):
        self.w = world

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        if sql.strip().startswith("SELECT id FROM users"):
            self.w["log"].append("select")
            rows = [(u,) for u in self.w["candidates"] if u > params["after"]]
            return _Res(rows[: params["lim"]])
        if "RETURNING id, email" in sql:
            self.w["log"].append("claim")
            out = []
            for uid in params["ids"]:
                if uid not in self.w["claimed_elsewhere"]:
                    out.append((uid, f"{uid}@x.com", "F", None, []))
            return _Res(out)
        if "SET last_statement_month = NULL" in sql:
            self.w["released"].extend(params["ids"])
            return _Res([])
        raise AssertionError(sql)

    async def commit(self):
        self.w["log"].append("commit")


class MonthlyStatementTests(unittest.TestCase):
    def setUp(self):
        self._orig = (mse.AsyncSessionLocal, mse.apply_email_brand, mse._legacy_sent_ids)
        self.sent = []
        smtp = types.ModuleType("packages.common.src.smtp_mail")

        async def send_email(to, subject, html, text=None):
            self.sent.append(to)
            if to.startswith(str(self.fail_uid)):
                return False
            return True

        smtp.send_email = send_email
        smtp.smtp_configured = lambda: True
        tmpl = types.ModuleType("packages.common.src.email_templates")
        tmpl.render_monthly_statement_available = lambda **k: ("s", "<p>h</p>", "t")
        self._mods = {k: sys.modules.get(k) for k in (smtp.__name__, tmpl.__name__)}
        sys.modules[smtp.__name__] = smtp
        sys.modules[tmpl.__name__] = tmpl

        async def no_brand(db, user):
            return None

        mse.apply_email_brand = no_brand
        self.fail_uid = None

    def tearDown(self):
        mse.AsyncSessionLocal, mse.apply_email_brand, mse._legacy_sent_ids = self._orig
        for k, v in self._mods.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v

    def _run(self, candidates, claimed_elsewhere=(), legacy=()):
        world = {"candidates": sorted(candidates), "claimed_elsewhere": set(claimed_elsewhere),
                 "released": [], "log": []}
        mse.AsyncSessionLocal = lambda: _Session(world)

        async def legacy_ids(ids, ym):
            return {i for i in ids if i in set(legacy)}

        mse._legacy_sent_ids = legacy_ids
        n = asyncio.run(mse.send_monthly_statements(None, "September, 2026", "2026-09"))
        return n, world

    def test_only_claimed_users_emailed_and_claim_committed_first(self):
        a, b, c = sorted([uuid4(), uuid4(), uuid4()])
        n, world = self._run([a, b, c], claimed_elsewhere={b})
        self.assertEqual(n, 2)
        self.assertEqual(sorted(self.sent), sorted([f"{a}@x.com", f"{c}@x.com"]))
        # claim UPDATE is committed before any send happens
        self.assertEqual(world["log"][:3], ["select", "claim", "commit"])

    def test_failed_send_releases_claim(self):
        a, b = sorted([uuid4(), uuid4()])
        self.fail_uid = a
        n, world = self._run([a, b])
        self.assertEqual(n, 1)
        self.assertEqual(world["released"], [a])

    def test_legacy_sent_users_not_emailed_twice(self):
        a, b = sorted([uuid4(), uuid4()])
        n, world = self._run([a, b], legacy={a})
        self.assertEqual(self.sent, [f"{b}@x.com"])


if __name__ == "__main__":
    unittest.main()

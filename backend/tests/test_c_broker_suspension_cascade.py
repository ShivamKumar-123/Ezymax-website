"""C4: suspending a broker cascades to its whole sub-broker subtree.

The existing tenancy helpers are cascade-aware (gateway callers unchanged):
admin auth (broker_is_suspended), partner-code lookup, domain lookup and the
tenant-host allow-list all refuse a broker whose ANCESTOR is suspended or
inactive.
"""
import asyncio
import unittest
import uuid
from types import SimpleNamespace

from packages.common.src import broker_tenancy as bt


class _Res:
    def __init__(self, one=None, rows=None):
        self._one = one
        self._rows = rows or []

    def scalar_one_or_none(self):
        return self._one

    def all(self):
        return list(self._rows)


class _DB:
    """Returns queued results in order."""
    def __init__(self, results):
        self._results = list(results)

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()


PARENT = uuid.uuid4()
CHILD = uuid.uuid4()


def _child_broker():
    return SimpleNamespace(id=CHILD, role="broker", status="active", broker_ancestry=[PARENT])


class CascadeTests(unittest.TestCase):
    def test_child_of_suspended_parent_is_suspended(self):
        db = _DB([
            _Res(one=SimpleNamespace(is_suspended=False)),                 # own profile
            _Res(rows=[(PARENT, "active", True), (CHILD, "active", False)]),  # chain
        ])
        self.assertTrue(asyncio.run(bt.broker_is_suspended(db, _child_broker())))

    def test_child_of_deactivated_parent_is_suspended(self):
        db = _DB([
            _Res(one=SimpleNamespace(is_suspended=False)),
            _Res(rows=[(PARENT, "blocked", False), (CHILD, "active", False)]),
        ])
        self.assertTrue(asyncio.run(bt.broker_is_suspended(db, _child_broker())))

    def test_healthy_chain_is_not_suspended(self):
        db = _DB([
            _Res(one=SimpleNamespace(is_suspended=False)),
            _Res(rows=[(PARENT, "active", False), (CHILD, "active", False)]),
        ])
        self.assertFalse(asyncio.run(bt.broker_is_suspended(db, _child_broker())))

    def test_missing_profile_counts_as_suspended(self):
        self.assertTrue(asyncio.run(bt.broker_is_suspended(_DB([_Res(one=None)]), _child_broker())))

    def test_partner_code_of_suspended_parent_subtree_does_not_resolve(self):
        db = _DB([
            _Res(one=SimpleNamespace(user_id=CHILD)),        # child's own profile (not suspended)
            _Res(one=_child_broker()),                       # owner row
            _Res(rows=[(PARENT, "active", True)]),           # ancestry check
        ])
        self.assertIsNone(asyncio.run(bt.find_broker_by_partner_code(db, "WL-CHILD")))

    def test_domain_of_suspended_parent_subtree_does_not_resolve(self):
        prof = SimpleNamespace(user_id=CHILD, custom_domain="child.com", app_subdomain=None)
        db = _DB([
            _Res(one=prof),
            _Res(one=_child_broker()),
            _Res(rows=[(PARENT, "active", True)]),
        ])
        self.assertIsNone(asyncio.run(bt.find_broker_by_domain(db, "child.com")))

    def test_tenant_hosts_drop_suspended_subtree(self):
        other = uuid.uuid4()
        bt.invalidate_tenant_hosts_cache()
        db = _DB([
            _Res(rows=[
                ("child.com", None, CHILD, [PARENT]),
                ("other.com", "trade", other, []),
            ]),
            _Res(rows=[(PARENT, "active", True), (CHILD, "active", False), (other, "active", False)]),
        ])
        hosts = asyncio.run(bt.active_tenant_hosts(db))
        bt.invalidate_tenant_hosts_cache()
        self.assertEqual(hosts, {"trade.other.com"})


class AdminAuthCascadeTests(unittest.TestCase):
    def test_get_current_admin_uses_cascade_helper(self):
        # The admin per-request gate and login must go through the cascade
        # helper, not a bare profile.is_suspended check.
        import os
        root = os.path.join(os.path.dirname(__file__), "..", "services", "admin")
        deps_src = open(os.path.join(root, "dependencies.py"), encoding="utf-8").read()
        auth_src = open(os.path.join(root, "services", "auth_service.py"), encoding="utf-8").read()
        self.assertIn("broker_tenancy.broker_is_suspended(db, admin)", deps_src)
        self.assertIn("broker_tenancy.broker_is_suspended(db, admin)", auth_src)


if __name__ == "__main__":
    unittest.main()

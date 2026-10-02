"""C5: smaller admin fixes.

* Login-as-employee: 1 h token bound to a revocable session (sid), carries
  impersonated_by, cannot be refreshed; a sid-less impersonation token is
  refused; audit rows written during it carry impersonated_by.
* Audit IP comes from the trusted header resolution, never a raw XFF list.
* Admin fund/credit amounts are Decimal, finite, bounded.
* Brand name: rejected if it contains < > " or CR/LF; legacy values are
  scrubbed before reaching email.
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import jwt
from fastapi import HTTPException
from pydantic import ValidationError

from packages.common.src.admin_schemas import FundRequest, CreditRequest
from packages.common.src import broker_tenancy as bt
from packages.common.src.models import AuditLog, UserSession

ADMIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
if ADMIN_DIR not in sys.path:
    sys.path.append(ADMIN_DIR)


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ADMIN_DIR, *rel.split("/")))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


import dependencies as deps  # noqa: E402

employee_service = _load("c_admin_employee_service", "services/employee_service.py")
auth_service = _load("c_admin_auth_service2", "services/auth_service.py")
S = auth_service.settings


class _Res:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []

    async def execute(self, *a, **k):
        return _Res(self._results.pop(0) if self._results else None)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        return None


class _Req:
    def __init__(self, headers=None, peer="10.0.0.5"):
        self.headers = headers or {}
        self.client = SimpleNamespace(host=peer)
        self.cookies = {}


class LoginAsEmployeeTests(unittest.TestCase):
    def _login_as(self):
        super_admin = SimpleNamespace(role="super_admin", id=uuid4())
        emp = SimpleNamespace(id=uuid4(), user_id=uuid4(), role="support", is_active=True)
        user = SimpleNamespace(id=emp.user_id, role="admin", status="active", email="e@x.com")
        db = _DB([emp, user])
        out = asyncio.run(employee_service.login_as_employee(emp.id, super_admin, "1.2.3.4", db))
        return out, db, super_admin

    def test_token_is_one_hour_with_sid_and_impersonated_by(self):
        out, db, sa = self._login_as()
        payload = jwt.decode(out["access_token"], S.ADMIN_JWT_SECRET, algorithms=[S.ADMIN_JWT_ALGORITHM])
        self.assertEqual(payload["impersonated_by"], str(sa.id))
        self.assertTrue(payload.get("sid"))
        ttl = payload["exp"] - payload["iat"]
        self.assertLessEqual(ttl, 3600)
        self.assertEqual(out["expires_in"], 3600)
        sessions = [o for o in db.added if isinstance(o, UserSession)]
        self.assertEqual(len(sessions), 1)
        self.assertEqual(str(sessions[0].id), payload["sid"])
        audits = [o for o in db.added if isinstance(o, AuditLog)]
        self.assertEqual(audits[0].new_values["impersonated_by"], str(sa.id))

    def test_impersonation_token_cannot_be_refreshed(self):
        out, _db, _sa = self._login_as()
        body = SimpleNamespace(access_token=out["access_token"])
        admin = SimpleNamespace(id=uuid4(), role="admin", first_name=None, last_name=None)
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(auth_service.admin_refresh(body=body, db=_DB([admin])))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_sidless_impersonation_token_rejected(self):
        now = datetime.now(timezone.utc)
        tok = jwt.encode(
            {"admin_id": str(uuid4()), "type": "admin", "impersonated_by": str(uuid4()),
             "exp": now + timedelta(hours=8), "iat": now},
            S.ADMIN_JWT_SECRET, algorithm=S.ADMIN_JWT_ALGORITHM,
        )
        req = _Req()
        req.cookies = {deps.ADMIN_COOKIE_NAME: tok}
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(deps.get_current_admin(request=req, credentials=None, db=_DB([])))
        self.assertEqual(ctx.exception.status_code, 401)


class AuditContextTests(unittest.TestCase):
    def test_audit_uses_trusted_ip_and_impersonated_by(self):
        async def go():
            deps._set_audit_context(
                _Req({"x-forwarded-for": "9.9.9.9, 203.0.113.9"}), "sa-123")
            db = _DB([])
            await deps.write_audit_log(db, uuid4(), "x", "user", None,
                                       new_values={"a": 1}, ip_address="10.0.0.5")
            return db.added[0]
        log = asyncio.run(go())
        self.assertEqual(str(log.ip_address), "203.0.113.9")
        self.assertEqual(log.new_values["impersonated_by"], "sa-123")
        self.assertEqual(log.new_values["a"], 1)

    def test_malformed_ip_never_breaks_audit_insert(self):
        async def go():
            db = _DB([])
            await deps.write_audit_log(db, uuid4(), "x", "user", None,
                                       ip_address="not-an-ip")
            return db.added[0]
        self.assertIsNone(asyncio.run(go()).ip_address)


class AmountSchemaTests(unittest.TestCase):
    def test_amounts_are_decimal(self):
        self.assertIsInstance(FundRequest(amount=0.1).amount, Decimal)
        self.assertEqual(CreditRequest(account_id="x", amount="12.34").amount, Decimal("12.34"))

    def test_amount_bounds(self):
        for bad in ("nan", "inf", "-1", "0", "10000000.01", "1.123456789"):
            with self.subTest(bad=bad):
                with self.assertRaises(ValidationError):
                    FundRequest(amount=bad)


class BrandNameTests(unittest.TestCase):
    def test_rejects_markup_and_newlines(self):
        for bad in ("<b>X</b>", 'A "B"', "A\r\nBcc: x@y", "Line\nbreak", "x" * 101):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    bt.validate_brand_name(bad)

    def test_accepts_normal_names(self):
        self.assertEqual(bt.validate_brand_name("  Acme Markets & Co.  "), "Acme Markets & Co.")
        self.assertIsNone(bt.validate_brand_name("   "))
        self.assertIsNone(bt.validate_brand_name(None))

    def test_email_brand_scrubs_legacy_value(self):
        from packages.common.src import email_branding

        broker_id = uuid4()
        owner = SimpleNamespace(id=broker_id)
        profile = SimpleNamespace(brand_name='Evil<script>"\r\nBcc', is_suspended=False,
                                  support_email=None)
        orig_owner, orig_prof = bt.resolve_branding_owner_for_user, bt.get_broker_profile

        async def _owner(db, user):
            return owner

        async def _prof(db, uid):
            return profile
        from packages.common.src.config import get_settings
        settings = get_settings()
        orig_enabled = settings.BRANDING_ENABLED
        bt.resolve_branding_owner_for_user, bt.get_broker_profile = _owner, _prof
        try:
            settings.BRANDING_ENABLED = True
            user = SimpleNamespace(assigned_broker_id=broker_id, broker_ancestry=[broker_id])
            brand = asyncio.run(email_branding.resolve_email_brand(None, user))
        finally:
            settings.BRANDING_ENABLED = orig_enabled
            bt.resolve_branding_owner_for_user, bt.get_broker_profile = orig_owner, orig_prof
        self.assertIsNotNone(brand)
        self.assertEqual(brand["name"], "EvilscriptBcc")
        for ch in '<>"\r\n':
            self.assertNotIn(ch, brand["name"])


if __name__ == "__main__":
    unittest.main()

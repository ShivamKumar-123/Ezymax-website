"""H-FE-ADMIN-2: saving Book/LP settings must ignore a blank or still-masked
secret so a no-edit submit can't overwrite the stored key/secret with dots.
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from uuid import uuid4

from packages.common.src.models import SystemSetting


def _load_book_service():
    admin_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
    if admin_dir not in sys.path:
        sys.path.append(admin_dir)
    path = os.path.join(admin_dir, "services", "book_service.py")
    spec = importlib.util.spec_from_file_location("admin_book_service", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


bs = _load_book_service()


class _Res:
    def scalar_one_or_none(self):
        return None


class _DB:
    def __init__(self):
        self.added = []

    async def execute(self, *a, **k):
        return _Res()

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None

    async def flush(self):
        return None


class LpSecretMaskingTests(unittest.TestCase):
    def test_masked_or_empty_detection(self):
        self.assertTrue(bs._is_masked_or_empty(""))
        self.assertTrue(bs._is_masked_or_empty("   "))
        self.assertTrue(bs._is_masked_or_empty("●●●●1234"))
        self.assertFalse(bs._is_masked_or_empty("realsecret123"))

    def test_masked_secret_not_persisted(self):
        db = _DB()
        asyncio.run(bs.save_lp_settings(
            api_url="https://lp", ws_url="wss://lp",
            api_key="●●●●1234",         # masked → must be ignored
            api_secret="brand-new-secret",  # real → must be saved
            admin_id=uuid4(), ip="1.2.3.4", db=db,
        ))
        saved_keys = {o.key for o in db.added if isinstance(o, SystemSetting)}
        self.assertIn("lp_api_url", saved_keys)
        self.assertIn("lp_ws_url", saved_keys)
        self.assertIn("lp_api_secret", saved_keys)
        self.assertNotIn("lp_api_key", saved_keys)  # masked value skipped


if __name__ == "__main__":
    unittest.main()

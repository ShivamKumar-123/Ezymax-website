"""C-ADMIN-1: served upload paths must be confined under the uploads root and
limited to image/PDF types (read side), and client-supplied screenshot paths
must be validated before they are stored (write side).
"""
import importlib.util
import os
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from fastapi import HTTPException

import packages.common.src.config as config
from services.gateway.src.services import wallet_service


def _load_admin_deposit_service():
    """Load services/admin/services/deposit_service.py as a standalone module.

    The admin service uses bare imports (`from dependencies import ...`), so its
    dir must be on sys.path; loading by file path avoids the `services` namespace
    clash that a normal `import services.admin...` triggers under this layout.
    """
    admin_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
    if admin_dir not in sys.path:
        sys.path.append(admin_dir)
    path = os.path.join(admin_dir, "services", "deposit_service.py")
    spec = importlib.util.spec_from_file_location("admin_deposit_service", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


deposit_service = _load_admin_deposit_service()


class AdminDownloadPathTests(unittest.TestCase):
    def setUp(self):
        self._tmp = TemporaryDirectory()
        base = Path(self._tmp.name)
        # WALLET_UPLOAD_ROOT=<base>/wallet → uploads root confinement = <base>.
        self._wallet = base / "wallet" / "deposits"
        self._wallet.mkdir(parents=True)
        (self._wallet / "proof.png").write_bytes(b"x")
        (self._wallet / "note.txt").write_bytes(b"x")
        self._settings = SimpleNamespace(WALLET_UPLOAD_ROOT=str(base / "wallet"))
        self._orig = config.get_settings
        config.get_settings = lambda: self._settings

    def tearDown(self):
        config.get_settings = self._orig
        self._tmp.cleanup()

    def test_legit_image_allowed(self):
        p = deposit_service._safe_upload_path(str(self._wallet / "proof.png"))
        self.assertTrue(p.name == "proof.png")

    def test_absolute_escape_rejected(self):
        with self.assertRaises(HTTPException):
            deposit_service._safe_upload_path("/etc/passwd")

    def test_traversal_rejected(self):
        with self.assertRaises(HTTPException):
            deposit_service._safe_upload_path("../../../../etc/passwd")

    def test_disallowed_extension_rejected(self):
        with self.assertRaises(HTTPException):
            deposit_service._safe_upload_path(str(self._wallet / "note.txt"))


class GatewayWriteTimeTests(unittest.TestCase):
    def setUp(self):
        self._tmp = TemporaryDirectory()
        base = Path(self._tmp.name)
        (base / "wallet" / "deposits").mkdir(parents=True)
        self._base = base
        self._settings = SimpleNamespace(WALLET_UPLOAD_ROOT=str(base / "wallet"))
        self._orig = wallet_service.get_settings
        wallet_service.get_settings = lambda: self._settings

    def tearDown(self):
        wallet_service.get_settings = self._orig
        self._tmp.cleanup()

    def test_safe_path_kept(self):
        good = str(self._base / "wallet" / "deposits" / "a.png")
        self.assertEqual(wallet_service._safe_stored_upload(good), good)

    def test_absolute_escape_dropped(self):
        self.assertIsNone(wallet_service._safe_stored_upload("/etc/passwd"))

    def test_traversal_dropped(self):
        self.assertIsNone(wallet_service._safe_stored_upload("../../secret"))

    def test_none_passthrough(self):
        self.assertIsNone(wallet_service._safe_stored_upload(None))


if __name__ == "__main__":
    unittest.main()

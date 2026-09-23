"""Phase 3: /auth/2fa/verify and /auth/password/change take their secrets in the
JSON body (Pydantic models), not as query params that leak into logs/history.
"""
import unittest

from pydantic import ValidationError

from services.gateway.src.api.auth import _Verify2faRequest, _ChangePasswordRequest


class AuthBodyModelTests(unittest.TestCase):
    def test_verify_2fa_body_model(self):
        self.assertEqual(_Verify2faRequest(code="123456").code, "123456")
        with self.assertRaises(ValidationError):
            _Verify2faRequest()

    def test_change_password_body_model(self):
        m = _ChangePasswordRequest(old_password="oldpw", new_password="newpw")
        self.assertEqual(m.old_password, "oldpw")
        self.assertEqual(m.new_password, "newpw")
        with self.assertRaises(ValidationError):
            _ChangePasswordRequest(old_password="x")


if __name__ == "__main__":
    unittest.main()

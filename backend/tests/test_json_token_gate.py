"""H-AUTH-3 (partial): the access token must not be echoed in the login/register
JSON body for cookie (web) clients; only a cookie-less client that opts in with
x-token-delivery: json (or the legacy flag) receives it.
"""
import unittest

from packages.common.src.config import Settings
from services.gateway.src.services.auth_service import _include_json_access_token


class JsonTokenGateTests(unittest.TestCase):
    def test_default_flag_off(self):
        # Cookie-first default: don't echo the token in JSON.
        self.assertFalse(Settings.model_fields["JWT_INCLUDE_LEGACY_JSON_TOKEN"].default)

    def test_cookie_client_gets_no_token(self):
        self.assertFalse(_include_json_access_token(legacy_flag=False, json_delivery=False))

    def test_mobile_optin_gets_token(self):
        self.assertTrue(_include_json_access_token(legacy_flag=False, json_delivery=True))

    def test_legacy_flag_forces_token(self):
        self.assertTrue(_include_json_access_token(legacy_flag=True, json_delivery=False))


if __name__ == "__main__":
    unittest.main()

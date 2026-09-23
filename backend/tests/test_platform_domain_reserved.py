"""Phase 3: a broker custom domain cannot be a platform host or any subdomain of
one (api./admin./trade. would hijack platform routing).
"""
import unittest

from packages.common.src import broker_tenancy as bt


class PlatformDomainTests(unittest.TestCase):
    def test_apex_reserved(self):
        self.assertTrue(bt.is_platform_domain("swisscresta.com"))

    def test_api_subdomain_reserved(self):
        self.assertTrue(bt.is_platform_domain("api.swisscresta.com"))

    def test_admin_subdomain_reserved(self):
        self.assertTrue(bt.is_platform_domain("admin.swisscresta.com"))

    def test_arbitrary_subdomain_reserved(self):
        self.assertTrue(bt.is_platform_domain("anything.swisscresta.com"))

    def test_broker_domain_allowed(self):
        self.assertFalse(bt.is_platform_domain("mybroker.com"))

    def test_lookalike_not_reserved(self):
        # must not match a domain that merely ENDS WITH the string without the dot
        self.assertFalse(bt.is_platform_domain("notswisscresta.com"))


if __name__ == "__main__":
    unittest.main()

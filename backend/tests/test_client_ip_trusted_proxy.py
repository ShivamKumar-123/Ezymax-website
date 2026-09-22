"""H-AUTH-1: client_ip_for_inet must return the real client IP by walking
X-Forwarded-For from the right and skipping our own proxy hops, so a spoofed
leftmost XFF entry can't bypass per-IP rate limits.
"""
import unittest
from types import SimpleNamespace

from packages.common.src.rate_limit import client_ip_for_inet


class _Req:
    def __init__(self, headers=None, peer=None):
        self.headers = headers or {}
        self.client = SimpleNamespace(host=peer) if peer else None


class ClientIpTests(unittest.TestCase):
    def test_cf_connecting_ip_wins(self):
        r = _Req({"cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "9.9.9.9"})
        self.assertEqual(client_ip_for_inet(r), "8.8.8.8")

    def test_skips_trailing_trusted_proxy_hop(self):
        # client 203.0.113.7 then our nginx (10.0.0.5, a trusted CIDR).
        r = _Req({"x-forwarded-for": "203.0.113.7, 10.0.0.5"})
        self.assertEqual(client_ip_for_inet(r), "203.0.113.7")

    def test_spoofed_leftmost_ignored(self):
        # attacker forges 9.9.9.9; nginx appends their real peer 203.0.113.9.
        r = _Req({"x-forwarded-for": "9.9.9.9, 203.0.113.9"})
        self.assertEqual(client_ip_for_inet(r), "203.0.113.9")

    def test_all_trusted_falls_back_to_leftmost(self):
        r = _Req({"x-forwarded-for": "10.0.0.4, 10.0.0.5"})
        self.assertEqual(client_ip_for_inet(r), "10.0.0.4")

    def test_no_headers_uses_peer(self):
        r = _Req({}, peer="198.51.100.2")
        self.assertEqual(client_ip_for_inet(r), "198.51.100.2")

    def test_returns_single_ip_never_comma_list(self):
        r = _Req({"x-forwarded-for": "203.0.113.7, 10.0.0.5"})
        out = client_ip_for_inet(r)
        self.assertNotIn(",", out or "")


if __name__ == "__main__":
    unittest.main()

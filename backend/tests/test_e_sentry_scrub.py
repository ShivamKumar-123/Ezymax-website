"""Section E (ops): Sentry events must never carry secrets / PII, and
background-task exceptions must be reported instead of vanishing."""
import asyncio
import unittest
from types import SimpleNamespace

from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from packages.common.src import instrumentation as inst

R = "[redacted]"


def _event():
    return {
        "request": {
            "url": "https://api.swisscresta.com/api/v1/positions?token=abc123&page=2",
            "method": "POST",
            "headers": {
                "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
                "Cookie": "sc_session=deadbeef",
                "X-Forwarded-For": "203.0.113.9",
                "X-Razorpay-Signature": "abcdef",
                "User-Agent": "pytest",
            },
            "cookies": {"sc_session": "deadbeef"},
            "query_string": "token=abc123&page=2",
            "data": {
                "password": "Hunter2!", "otp": "123456", "amount": "100",
                "bank_account_number": "123456789012", "ifsc_code": "HDFC0001234",
                "upi_id": "alice@okhdfc", "pan_number": "ABCDE1234F",
                "email": "alice@example.com", "nested": {"api_key": "k", "symbol": "EURUSD"},
            },
        },
        "user": {"id": "u-1", "email": "alice@example.com", "ip_address": "1.2.3.4",
                 "username": "alice"},
        "extra": {"secret": "s", "note": "contact bob@example.com, PAN ABCDE1234F"},
        "tags": {"symbol": "EURUSD"},
        "logentry": {"message": "login failed for %s", "params": ["alice@example.com"]},
        "exception": {"values": [{
            "type": "ValueError",
            "value": "bad IFSC HDFC0001234 for carol@example.com password=hunter2",
            "stacktrace": {"frames": [{
                "function": "withdraw",
                "vars": {"password": "'p'", "totp_code": "'654321'", "amount": "'5'",
                         "jwt": "'x'", "account_number": "'99887766'"},
            }]},
        }]},
        "breadcrumbs": {"values": [
            {"category": "httplib", "message": "GET https://x/cb?otp=999111",
             "data": {"url": "https://x/cb?otp=999111&ok=1", "method": "GET"}},
            {"category": "log", "message": "sent OTP to dave@example.com"},
        ]},
    }


class ScrubEventTests(unittest.TestCase):
    def setUp(self):
        self.ev = inst.scrub_event(_event(), {})
        self.blob = repr(self.ev)

    def test_no_secret_or_pii_survives(self):
        for needle in ("Hunter2", "hunter2", "123456", "deadbeef", "eyJhbGci",
                       "203.0.113.9", "abc123", "alice@", "bob@", "carol@", "dave@",
                       "ABCDE1234F", "HDFC0001234", "okhdfc", "123456789012",
                       "654321", "99887766", "999111", "abcdef"):
            self.assertNotIn(needle, self.blob, needle)

    def test_headers(self):
        h = self.ev["request"]["headers"]
        self.assertEqual(h["Authorization"], R)
        self.assertEqual(h["Cookie"], R)
        self.assertEqual(h["X-Forwarded-For"], R)
        self.assertEqual(h["User-Agent"], "pytest")
        self.assertEqual(self.ev["request"]["cookies"], R)

    def test_body_scrubbed_by_key_keeps_harmless_fields(self):
        d = self.ev["request"]["data"]
        self.assertEqual(d["amount"], "100")
        self.assertEqual(d["nested"]["symbol"], "EURUSD")
        for k in ("password", "otp", "bank_account_number", "ifsc_code", "upi_id",
                  "pan_number", "email"):
            self.assertEqual(d[k], R, k)
        self.assertEqual(d["nested"]["api_key"], R)

    def test_query_string_and_url(self):
        self.assertIn("page=2", self.ev["request"]["query_string"])
        self.assertIn("page=2", self.ev["request"]["url"])

    def test_sensitive_path_drops_body_wholesale(self):
        ev = _event()
        ev["request"]["url"] = "https://api.swisscresta.com/api/v1/wallet/withdraw"
        ev["request"]["data"] = {"amount": "1"}
        self.assertEqual(inst.scrub_event(ev, {})["request"]["data"], R)

    def test_auth_query_string_dropped(self):
        ev = _event()
        ev["request"]["url"] = "https://api.swisscresta.com/api/v1/auth/google?page=1"
        self.assertEqual(inst.scrub_event(ev, {})["request"]["query_string"], R)

    def test_user_reduced_to_id(self):
        self.assertEqual(self.ev["user"], {"id": "u-1"})

    def test_frame_vars_and_exception_message(self):
        exc = self.ev["exception"]["values"][0]
        v = exc["stacktrace"]["frames"][0]["vars"]
        self.assertEqual(v["amount"], "'5'")
        self.assertEqual(v["password"], R)
        self.assertEqual(v["totp_code"], R)
        self.assertIn("ValueError", exc["type"])
        self.assertIn("bad IFSC", exc["value"])

    def test_no_over_scrubbing(self):
        self.assertFalse(inst.is_sensitive_key("status_code"))
        self.assertFalse(inst.is_sensitive_key("company"))
        self.assertFalse(inst.is_sensitive_key("symbol"))
        self.assertEqual(inst.scrub_text("company=Acme status_code=500"),
                         "company=Acme status_code=500")
        self.assertTrue(inst.is_sensitive_key("X-Api-Key"))
        self.assertTrue(inst.is_sensitive_key("refresh_token"))

    def test_header_pair_list_form(self):
        out = inst.scrub_data([["Authorization", "Bearer x"], ["Accept", "json"]])
        self.assertEqual(out, [["Authorization", R], ["Accept", "json"]])

    def test_breadcrumb_hook(self):
        c = inst.scrub_breadcrumb({"message": "otp=424242 for e@x.io",
                                   "data": {"url": "https://h/p?token=t1&a=b"}}, {})
        self.assertNotIn("424242", repr(c))
        self.assertNotIn("e@x.io", repr(c))
        self.assertNotIn("t1", c["data"]["url"])
        self.assertIn("a=b", c["data"]["url"])

    def test_scrub_never_raises_and_never_drops(self):
        weird = {"request": {"headers": object(), "url": 5}, "extra": {"password": "x"}}
        out = inst.scrub_event(weird, {})
        self.assertIsNotNone(out)
        self.assertNotIn("'x'", repr(out.get("extra")))


class InitSentryWiringTests(unittest.TestCase):
    def test_hooks_passed_to_sdk(self):
        import sentry_sdk
        captured = {}
        orig_settings, orig_init, orig_tag = inst.settings, sentry_sdk.init, sentry_sdk.set_tag
        inst.settings = SimpleNamespace(SENTRY_DSN="https://k@o.ingest.sentry.io/1",
                                        SENTRY_TRACES_SAMPLE_RATE=0.0, ENVIRONMENT="test")
        sentry_sdk.init = lambda **kw: captured.update(kw)
        sentry_sdk.set_tag = lambda *a, **k: None
        try:
            inst.init_sentry("unit")
        finally:
            inst.settings, sentry_sdk.init, sentry_sdk.set_tag = orig_settings, orig_init, orig_tag
        self.assertIs(captured["before_send"], inst.scrub_event)
        self.assertIs(captured["before_send_transaction"], inst.scrub_event)
        self.assertIs(captured["before_breadcrumb"], inst.scrub_breadcrumb)
        self.assertFalse(captured["send_default_pii"])


class BackgroundReportingTests(unittest.TestCase):
    def setUp(self):
        self.reported = []
        self._orig = inst.report_exception
        inst.report_exception = lambda exc, **kw: self.reported.append((exc, kw))

    def tearDown(self):
        inst.report_exception = self._orig

    def test_spawn_reports_failure(self):
        async def boom():
            raise RuntimeError("engine died")

        async def main():
            t = inst.spawn(boom(), name="copy-engine")
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            return t

        t = asyncio.run(main())
        self.assertEqual(len(self.reported), 1)
        exc, kw = self.reported[0]
        self.assertIsInstance(exc, RuntimeError)
        self.assertEqual(kw["where"], "task:copy-engine")
        self.assertNotIn(t, inst._BACKGROUND_TASKS)

    def test_spawn_ignores_cancel_and_success(self):
        async def ok():
            return 1

        async def forever():
            await asyncio.sleep(10)

        async def main():
            inst.spawn(ok())
            t = inst.spawn(forever())
            await asyncio.sleep(0)
            t.cancel()
            await asyncio.sleep(0)
            await asyncio.sleep(0)

        asyncio.run(main())
        self.assertEqual(self.reported, [])

    def test_loop_handler_reports_and_is_idempotent(self):
        async def main():
            loop = asyncio.get_running_loop()
            self.assertTrue(inst.install_asyncio_exception_reporting())
            self.assertTrue(inst.install_asyncio_exception_reporting())
            self.assertIs(loop.get_exception_handler(), inst._loop_exception_handler)
            loop.call_exception_handler({"message": "Task exception was never retrieved",
                                         "exception": ValueError("lost")})

        asyncio.run(main())
        self.assertEqual(len(self.reported), 1)
        self.assertIsInstance(self.reported[0][0], ValueError)

    def test_install_keeps_existing_custom_handler(self):
        async def main():
            loop = asyncio.get_running_loop()
            custom = lambda l, c: None  # noqa: E731
            loop.set_exception_handler(custom)
            self.assertFalse(inst.install_asyncio_exception_reporting())
            self.assertIs(loop.get_exception_handler(), custom)

        asyncio.run(main())

    def test_install_without_loop_is_noop(self):
        self.assertFalse(inst.install_asyncio_exception_reporting())

    def test_middleware_stack_installs_on_lifespan_and_passes_http(self):
        seen = {}

        async def home(request):
            seen["handler"] = asyncio.get_running_loop().get_exception_handler()
            return PlainTextResponse("ok")

        app = Starlette(routes=[Route("/", home)])
        app.add_middleware(inst.BackgroundErrorReportingMiddleware)
        with TestClient(app) as client:  # runs lifespan startup
            r = client.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.text, "ok")
        self.assertIs(seen["handler"], inst._loop_exception_handler)


class ReportExceptionTests(unittest.TestCase):
    def test_report_without_sentry_does_not_raise(self):
        try:
            raise KeyError("x")
        except KeyError as e:
            inst.report_exception(e, where="unit", account_id=5, obj=object())


if __name__ == "__main__":
    unittest.main()

"""RequestSizeLimitMiddleware must cap the bytes actually streamed.

The old version trusted only the Content-Length header, so a chunked
(Transfer-Encoding) upload with no Content-Length bypassed the cap, and a
malformed Content-Length crashed with a 500.
"""
import unittest

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from packages.common.src.instrumentation import RequestSizeLimitMiddleware

LIMIT = 1024


async def _echo(request: Request):
    body = await request.body()
    return JSONResponse({"size": len(body)})


def _client() -> TestClient:
    app = Starlette(routes=[Route("/up", _echo, methods=["POST"])])
    app.add_middleware(RequestSizeLimitMiddleware, max_size=LIMIT)
    return TestClient(app)


def _chunks(total: int, size: int = 256):
    sent = 0
    while sent < total:
        n = min(size, total - sent)
        sent += n
        yield b"x" * n


class RequestSizeLimitTests(unittest.TestCase):
    def test_small_body_passes(self):
        r = _client().post("/up", content=b"x" * 100)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["size"], 100)

    def test_declared_content_length_over_limit_rejected(self):
        r = _client().post("/up", content=b"x" * (LIMIT + 1))
        self.assertEqual(r.status_code, 413)

    def test_chunked_body_over_limit_rejected(self):
        # Generator body → httpx sends Transfer-Encoding: chunked, no Content-Length.
        r = _client().post("/up", content=_chunks(LIMIT * 4))
        self.assertEqual(r.status_code, 413)

    def test_chunked_body_under_limit_passes(self):
        r = _client().post("/up", content=_chunks(LIMIT // 2))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["size"], LIMIT // 2)

    def test_malformed_content_length_is_400_not_500(self):
        r = _client().post("/up", content=b"abc", headers={"content-length": "abc"})
        self.assertEqual(r.status_code, 400)


if __name__ == "__main__":
    unittest.main()

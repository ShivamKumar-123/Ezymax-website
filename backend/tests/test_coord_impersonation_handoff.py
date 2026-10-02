"""Admin "Login As" hand-off token: typ=impersonation, 120 s, and the gateway
accepts it only while fresh."""
import os
import re
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from services.gateway.src.services import auth_service as svc


def _payload(age_s: int) -> dict:
    iat = datetime.now(timezone.utc) - timedelta(seconds=age_s)
    return {
        "sub": str(uuid4()), "role": "user", "type": "user",
        "typ": "impersonation", "impersonated_by": str(uuid4()),
        "iat": iat.timestamp(), "exp": (iat + timedelta(seconds=120)).timestamp(),
    }


def test_fresh_handoff_token_accepted():
    assert svc._is_impersonation_handoff(_payload(5)) is True


def test_stale_handoff_token_refused():
    assert svc._is_impersonation_handoff(_payload(180)) is False


def test_session_token_never_accepted_as_handoff():
    p = _payload(5)
    p["sid"] = str(uuid4())
    assert svc._is_impersonation_handoff(p) is False


def test_admin_mints_short_typed_handoff_token():
    path = os.path.join(os.path.dirname(__file__), "..", "services", "admin", "services", "user_service.py")
    src = open(path, encoding="utf-8").read()
    block = src[src.index("async def login_as_user"):]
    block = block[: block.index("jwt.encode")]
    assert '"typ": "impersonation"' in block
    assert "timedelta(seconds=120)" in block
    assert not re.search(r"timedelta\(hours=\d+\)", block)

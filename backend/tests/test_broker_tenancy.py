"""White-label tenancy core — pure-logic tests for the stock4x port.

Covers the permission cap math, creator-chain stamping, pool assignment,
login isolation, and domain/host normalisation in
packages/common/src/broker_tenancy.py. No DB required.
"""
import uuid

import pytest

from packages.common.src.broker_tenancy import (
    clip_permissions_to_cap,
    full_permission_cap,
    host_from_request_headers,
    max_grantable_permissions,
    normalise_domain,
    normalise_subdomain,
    pool_assignment_for_owner,
    resolve_creator_chain,
    served_hostnames,
    user_belongs_to_owner,
    validate_permissions_against_cap,
)
from packages.common.src.models import User, BrokerProfile


def _user(role: str, **kw) -> User:
    u = User(email=f"{uuid.uuid4().hex[:8]}@x.com", role=role)
    u.id = uuid.uuid4()
    u.broker_ancestry = kw.get("broker_ancestry", [])
    u.assigned_broker_id = kw.get("assigned_broker_id")
    return u


# ── Permission caps ──────────────────────────────────────────────────

def test_super_admin_cap_is_full_edit():
    cap = max_grantable_permissions(_user("super_admin"), None)
    assert all(v == "edit" for v in cap.values())


def test_broker_cap_mirrors_own_grants():
    broker = _user("broker")
    profile = BrokerProfile(user_id=broker.id, partner_code="WL-TEST0001")
    profile.permissions = {"users": "edit", "deposits": "view"}
    cap = max_grantable_permissions(broker, profile)
    assert cap["users"] == "edit"
    assert cap["deposits"] == "view"
    assert cap["withdrawals"] == "off"


def test_validate_rejects_grant_above_cap():
    cap = {"users": "view", "deposits": "off"}
    with pytest.raises(ValueError):
        validate_permissions_against_cap({"users": "edit"}, cap)
    with pytest.raises(ValueError):
        validate_permissions_against_cap({"deposits": "view"}, cap)


def test_validate_rejects_unknown_section_and_level():
    cap = full_permission_cap()
    with pytest.raises(ValueError):
        validate_permissions_against_cap({"banks": "edit"}, cap)
    with pytest.raises(ValueError):
        validate_permissions_against_cap({"users": "admin"}, cap)


def test_validate_drops_explicit_off():
    cap = full_permission_cap()
    cleaned = validate_permissions_against_cap({"users": "edit", "kyc": "off"}, cap)
    assert cleaned == {"users": "edit"}


def test_clip_cascades_parent_downgrade():
    current = {"users": "edit", "deposits": "edit", "trades": "view"}
    cap = {"users": "view", "deposits": "off", "trades": "edit"}
    clipped, changed = clip_permissions_to_cap(current, cap)
    assert clipped == {"users": "view", "trades": "view"}
    assert set(changed) == {"users", "deposits"}


# ── Creator chain / pool stamping ────────────────────────────────────

def test_creator_chain_super_admin_mints_top_level():
    assert resolve_creator_chain(_user("super_admin")) == (None, [])


def test_creator_chain_broker_mints_nested_sub_broker():
    top = _user("broker")
    sub = _user("broker", broker_ancestry=[top.id], assigned_broker_id=top.id)
    parent_id, ancestry = resolve_creator_chain(sub)
    assert parent_id == sub.id
    assert ancestry == [top.id, sub.id]


def test_creator_chain_rejects_client_roles():
    with pytest.raises(ValueError):
        resolve_creator_chain(_user("user"))


def test_pool_assignment_for_broker_owner():
    top = _user("broker")
    sub = _user("broker", broker_ancestry=[top.id], assigned_broker_id=top.id)
    pool = pool_assignment_for_owner(sub)
    assert pool["assigned_broker_id"] == sub.id
    assert pool["broker_ancestry"] == [top.id, sub.id]
    assert pool_assignment_for_owner(None) == {}
    assert pool_assignment_for_owner(_user("super_admin")) == {}


# ── Login isolation ──────────────────────────────────────────────────

def test_login_fails_open_on_platform_host():
    assert user_belongs_to_owner(_user("user"), None) is True


def test_login_blocks_cross_tenant():
    broker_a = _user("broker")
    broker_b = _user("broker")
    client_of_a = _user("user", broker_ancestry=[broker_a.id], assigned_broker_id=broker_a.id)
    assert user_belongs_to_owner(client_of_a, broker_a) is True
    assert user_belongs_to_owner(client_of_a, broker_b) is False
    # Sub-broker's client still admitted on the TOP broker's domain.
    deep_client = _user("user", broker_ancestry=[broker_a.id, uuid.uuid4()])
    assert user_belongs_to_owner(deep_client, broker_a) is True


def test_broker_admits_itself():
    b = _user("broker")
    assert user_belongs_to_owner(b, b) is True


# ── Domain / host handling ───────────────────────────────────────────

def test_normalise_domain_strips_scheme_www_path_port():
    assert normalise_domain("https://www.BrokerX.com/path?q=1") == "brokerx.com"
    assert normalise_domain("brokerx.com:443") == "brokerx.com"
    with pytest.raises(ValueError):
        normalise_domain("not a domain")
    with pytest.raises(ValueError):
        normalise_domain("")


def test_normalise_subdomain():
    assert normalise_subdomain(" Trade ") == "trade"
    assert normalise_subdomain("") == ""
    with pytest.raises(ValueError):
        normalise_subdomain("www")
    with pytest.raises(ValueError):
        normalise_subdomain("admin")  # reserved for the tenant admin panel


def test_served_hostnames_modes():
    assert served_hostnames("brokerx.com", None) == ["brokerx.com", "www.brokerx.com"]
    assert served_hostnames("brokerx.com", "trade") == ["trade.brokerx.com"]


def test_host_from_request_headers_prefers_origin():
    assert host_from_request_headers("https://brokerx.com", "https://other.com/p") == "brokerx.com"
    assert host_from_request_headers(None, "https://other.com/p") == "other.com"
    assert host_from_request_headers(None, None) is None

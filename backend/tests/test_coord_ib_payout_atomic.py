"""IB pending_payout must be accrued atomically, and the payout must credit a
LOCKED trading account.

A read-modify-write `ib.pending_payout = ib.pending_payout + x` loses an
increment when two trades accrue to the same IB concurrently.
"""
import asyncio
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy.sql.dml import Update

from packages.common.src import ib_commission


class _RecDB:
    def __init__(self):
        self.statements = []

    async def execute(self, stmt, *a, **k):
        self.statements.append(stmt)
        return SimpleNamespace()


def test_accrual_is_a_single_atomic_update():
    db = _RecDB()
    ib_id = uuid4()
    asyncio.run(ib_commission._accrue_pending_payout(db, ib_id, Decimal("12.5")))
    assert len(db.statements) == 1
    stmt = db.statements[0]
    assert isinstance(stmt, Update)
    sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    # SET pending_payout = coalesce(pending_payout, 0) + 12.5 — computed in SQL.
    assert "pending_payout" in sql and "coalesce" in sql.lower() and "12.5" in sql


def test_accrual_never_assigns_the_python_attribute():
    src = open(ib_commission.__file__, encoding="utf-8").read()
    assert ".pending_payout = (" not in src

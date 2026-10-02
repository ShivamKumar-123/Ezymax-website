"""A2: every lock helper must refresh the identity map (populate_existing) —
otherwise a row loaded before the lock is returned stale and two concurrent
withdrawals of 100 against a balance of 100 both pass.
"""
import asyncio
import unittest
from uuid import uuid4

from sqlalchemy import select

from packages.common.src.models import User
from packages.common.src.row_locks import for_update, lock_account, lock_user


class _Result:
    def scalar_one_or_none(self):
        return "row"


class _DB:
    def __init__(self):
        self.stmt = None

    async def execute(self, stmt, *a, **k):
        self.stmt = stmt
        return _Result()


def _populates(stmt) -> bool:
    return bool(stmt.get_execution_options().get("populate_existing"))


class PopulateExistingTests(unittest.TestCase):
    def test_lock_user_populates_existing(self):
        db = _DB()
        asyncio.run(lock_user(db, uuid4()))
        self.assertIsNotNone(db.stmt._for_update_arg)
        self.assertTrue(_populates(db.stmt))

    def test_lock_account_populates_existing(self):
        db = _DB()
        asyncio.run(lock_account(db, uuid4(), user_id=uuid4()))
        self.assertIsNotNone(db.stmt._for_update_arg)
        self.assertTrue(_populates(db.stmt))

    def test_for_update_helper(self):
        stmt = for_update(select(User).where(User.id == uuid4()))
        self.assertIsNotNone(stmt._for_update_arg)
        self.assertTrue(_populates(stmt))


if __name__ == "__main__":
    unittest.main()

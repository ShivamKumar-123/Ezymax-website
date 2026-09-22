"""C-TRADE-4 / H-TRADE-1: lock_user / lock_account must issue a SELECT ... FOR
UPDATE so concurrent balance mutations serialise on the row.
"""
import asyncio
import unittest
from uuid import uuid4

from packages.common.src.row_locks import lock_user, lock_account


class _Result:
    def scalar_one_or_none(self):
        return "row"


class _CapturingDB:
    def __init__(self):
        self.stmt = None

    async def execute(self, stmt, *a, **k):
        self.stmt = stmt
        return _Result()


class RowLockTests(unittest.TestCase):
    def test_lock_user_is_for_update(self):
        db = _CapturingDB()
        row = asyncio.run(lock_user(db, uuid4()))
        self.assertEqual(row, "row")
        self.assertIsNotNone(db.stmt._for_update_arg)

    def test_lock_account_is_for_update(self):
        db = _CapturingDB()
        asyncio.run(lock_account(db, uuid4()))
        self.assertIsNotNone(db.stmt._for_update_arg)

    def test_lock_account_ownership_filter(self):
        db = _CapturingDB()
        uid = uuid4()
        asyncio.run(lock_account(db, uuid4(), user_id=uid))
        # two WHERE predicates (id + user_id) when ownership is enforced.
        sql = str(db.stmt)
        self.assertIn("user_id", sql)
        self.assertIsNotNone(db.stmt._for_update_arg)


if __name__ == "__main__":
    unittest.main()

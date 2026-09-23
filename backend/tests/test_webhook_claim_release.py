"""Phase 3: if webhook processing fails after the dedup claim is committed, the
claim is released so the provider's retry re-processes (no lost credit).
"""
import asyncio
import unittest

from services.gateway.src.api import webhooks


class _DB:
    def __init__(self):
        self.executed = []
        self.commits = 0
        self.rollbacks = 0

    async def execute(self, stmt, *a, **k):
        self.executed.append(stmt)

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


class WebhookClaimReleaseTests(unittest.TestCase):
    def test_release_deletes_and_commits(self):
        db = _DB()
        asyncio.run(webhooks._release_webhook_claim(
            db, provider="oxapay", external_id="ord-1", status="paid",
        ))
        self.assertEqual(len(db.executed), 1)               # the DELETE ran
        self.assertIn("DELETE", str(db.executed[0]).upper())
        self.assertGreaterEqual(db.commits, 1)


if __name__ == "__main__":
    unittest.main()

"""H-INF-9: production boot must refuse a default DB password (swisscresta_dev)
in DATABASE_URL / TIMESCALE_URL, like it already refuses default JWT secrets.
"""
import unittest
from types import SimpleNamespace

from packages.common.src import config

_STRONG_JWT = "x" * 48
_GOOD_DB = "postgresql+asyncpg://swisscresta:Str0ng-DB-pw@postgres:5432/swisscresta"
_WEAK_DB = "postgresql+asyncpg://swisscresta:swisscresta_dev@postgres:5432/swisscresta"


def _settings(**over):
    base = dict(
        ENVIRONMENT="production",
        JWT_SECRET=_STRONG_JWT, ADMIN_JWT_SECRET=_STRONG_JWT, USER_JWT_SECRET=_STRONG_JWT,
        ADMIN_PASSWORD="Str0ng!-Admin-Passw0rd",
        DATABASE_URL=_GOOD_DB, TIMESCALE_URL=_GOOD_DB,
    )
    base.update(over)
    return SimpleNamespace(**base)


class WeakDbPasswordGuardTests(unittest.TestCase):
    def test_weak_database_url_rejected(self):
        with self.assertRaises(RuntimeError) as ctx:
            config._assert_production_secrets(_settings(DATABASE_URL=_WEAK_DB))
        self.assertIn("DATABASE_URL", str(ctx.exception))

    def test_weak_timescale_url_rejected(self):
        with self.assertRaises(RuntimeError) as ctx:
            config._assert_production_secrets(_settings(TIMESCALE_URL=_WEAK_DB))
        self.assertIn("TIMESCALE_URL", str(ctx.exception))

    def test_all_strong_boots(self):
        config._assert_production_secrets(_settings())  # no raise

    def test_dev_env_does_not_raise(self):
        config._assert_production_secrets(_settings(ENVIRONMENT="development", DATABASE_URL=_WEAK_DB))


if __name__ == "__main__":
    unittest.main()

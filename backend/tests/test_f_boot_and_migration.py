"""Section F6/F7: no DDL at boot, migration 0076 shape, healer safety, and
RUN_ENGINES gating."""
import asyncio
import importlib.util
import inspect
import pathlib
import unittest

from services.gateway.src import main as gw

_MIG = next(
    pathlib.Path(__file__).resolve().parents[1]
    .joinpath("infra", "migrations", "versions").glob("*_0076_*.py")
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("mig0076", _MIG)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class MigrationTests(unittest.TestCase):
    def test_revision_chain(self):
        m = _load_migration()
        self.assertEqual((m.revision, m.down_revision), ("0076", "0072"))

    def test_indexes_concurrent_in_autocommit_and_no_unique_on_trade_history(self):
        src = _MIG.read_text(encoding="utf-8")
        self.assertIn("autocommit_block()", src)
        self.assertIn("CREATE INDEX CONCURRENTLY IF NOT EXISTS", src)
        self.assertIn("CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS {_COPY_UNIQUE}", src)
        self.assertIn('_COPY_UNIQUE = "uq_copy_trades_master_pos_alloc"', src)
        self.assertIn("RAISE WARNING", src)  # duplicates warn, never delete
        self.assertNotIn("DELETE FROM", src)
        m = _load_migration()
        for name, table, definition in m._INDEXES:
            if table == "trade_history":
                self.assertNotIn("UNIQUE", definition.upper())
        self.assertTrue(callable(m.downgrade))


class NoBootDDLTests(unittest.TestCase):
    def test_gateway_lifespan_has_no_ddl(self):
        src = inspect.getsource(gw.lifespan)
        for bad in ("ALTER TABLE", "CREATE TABLE", "_backfill_close_reasons",
                    "_ensure_pamm_units_column", "_ensure_push_tokens_table",
                    "_ensure_ohlc_bars_table"):
            self.assertNotIn(bad, src)

    def test_admin_lifespan_has_no_ddl(self):
        path = pathlib.Path(__file__).resolve().parents[1] / "services" / "admin" / "main.py"
        src = path.read_text(encoding="utf-8")
        code = "\n".join(ln for ln in src.splitlines() if not ln.lstrip().startswith("#"))
        for bad in ("users_role_check", "ALTER TABLE", "CREATE TABLE", "_apply_startup_ddl"):
            self.assertNotIn(bad, code)

    def test_healer_is_skip_locked_and_on_conflict(self):
        sql = str(gw._HEAL_SQL)
        self.assertIn("FOR UPDATE OF p SKIP LOCKED", sql)
        self.assertIn("ON CONFLICT DO NOTHING", sql)


class RunEnginesTests(unittest.TestCase):
    def test_run_engines_false_starts_no_engine(self):
        started = []

        class _Eng:
            def __init__(self, n):
                self.n = n

            async def start(self):
                started.append(self.n)

            async def stop(self):
                pass

        class _Hub:
            async def start(self):
                pass

            async def stop(self):
                pass

            def subscribe(self, *a, **k):
                return type("S", (), {"close": lambda self: None})()

        class _PC:
            async def start(self, hub=None):
                pass

            async def stop(self):
                pass

        class _R:
            async def close(self):
                pass

        orig = (gw._ENGINES, gw.pubsub_hub, gw.price_cache, gw.redis_client,
                getattr(gw.settings, "RUN_ENGINES", True))
        gw._ENGINES = (_Eng("a"), _Eng("b"))
        gw.pubsub_hub, gw.price_cache, gw.redis_client = _Hub(), _PC(), _R()

        async def run(flag):
            object.__setattr__(gw.settings, "RUN_ENGINES", flag)
            async with gw.lifespan(gw.app):
                pass

        try:
            asyncio.run(run(False))
            self.assertEqual(started, [])
            asyncio.run(run(True))
            self.assertEqual(started, ["a", "b"])
        finally:
            (gw._ENGINES, gw.pubsub_hub, gw.price_cache, gw.redis_client, flag) = orig
            object.__setattr__(gw.settings, "RUN_ENGINES", flag)


if __name__ == "__main__":
    unittest.main()

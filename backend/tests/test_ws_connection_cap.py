"""Phase 3: per-user WebSocket connection cap — a single user can't hold
unbounded concurrent streams.
"""
import unittest

from services.gateway.src import main as gw_main


class WsConnectionCapTests(unittest.TestCase):
    def setUp(self):
        gw_main._ws_user_conn_counts.clear()

    def tearDown(self):
        gw_main._ws_user_conn_counts.clear()

    def test_cap_enforced(self):
        uid = "user-1"
        for _ in range(gw_main._WS_MAX_PER_USER):
            self.assertTrue(gw_main._ws_try_acquire(uid))
        self.assertFalse(gw_main._ws_try_acquire(uid))  # over the cap

    def test_release_frees_a_slot(self):
        uid = "user-2"
        for _ in range(gw_main._WS_MAX_PER_USER):
            gw_main._ws_try_acquire(uid)
        self.assertFalse(gw_main._ws_try_acquire(uid))
        gw_main._ws_release(uid)
        self.assertTrue(gw_main._ws_try_acquire(uid))  # slot freed

    def test_anonymous_never_capped(self):
        for _ in range(gw_main._WS_MAX_PER_USER * 3):
            self.assertTrue(gw_main._ws_try_acquire(None))

    def test_release_cleans_up_to_zero(self):
        uid = "user-3"
        gw_main._ws_try_acquire(uid)
        gw_main._ws_release(uid)
        self.assertNotIn(uid, gw_main._ws_user_conn_counts)


if __name__ == "__main__":
    unittest.main()

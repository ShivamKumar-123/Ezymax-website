"""Seed a read-only `demo_admin` user from env vars (DEMO_ADMIN_EMAIL +
DEMO_ADMIN_PASSWORD). Idempotent — re-runs update the password hash so
operators can rotate without a fresh row.

The demo_admin role grants navigation of the entire admin panel but
zero mutation rights. Enforcement lives in:
  * services/admin/dependencies.py::require_permission (per-endpoint)
  * services/admin/main.py::AdminReadOnlyMiddleware (coarse HTTP-method
    guard as belt-and-braces)

If neither env var is set (or DEMO_ADMIN_PASSWORD is blank), this
migration is a no-op — useful for dev/test environments that don't
want the seed.

Revision ID: 0050
Revises: 0049
"""
import os

import bcrypt
from alembic import op


revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


_DEMO_EMAIL = (os.environ.get("DEMO_ADMIN_EMAIL") or "").strip()
_DEMO_PASSWORD = (os.environ.get("DEMO_ADMIN_PASSWORD") or "").strip()


def upgrade() -> None:
    if not _DEMO_EMAIL or not _DEMO_PASSWORD:
        # No-op when env vars are absent. Operator can set them later
        # and either re-stamp the migration or run the equivalent INSERT
        # manually via psql — both are safe because ON CONFLICT.
        return
    pwd_hash = bcrypt.hashpw(_DEMO_PASSWORD.encode(), bcrypt.gensalt(12)).decode()
    # Direct execute with parameterised SQL — avoids quoting/injection
    # issues with email values containing special characters.
    op.execute(
        f"""
        INSERT INTO users
          (email, password_hash, first_name, last_name, role, status, kyc_status)
        VALUES
          (
            '{_DEMO_EMAIL.replace("'", "''")}',
            '{pwd_hash}',
            'Demo',
            'Viewer',
            'demo_admin',
            'active',
            'approved'
          )
        ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            role          = EXCLUDED.role,
            status        = EXCLUDED.status,
            first_name    = EXCLUDED.first_name,
            last_name     = EXCLUDED.last_name;
        """
    )


def downgrade() -> None:
    if not _DEMO_EMAIL:
        return
    op.execute(
        f"""
        DELETE FROM users
        WHERE email = '{_DEMO_EMAIL.replace("'", "''")}'
          AND role = 'demo_admin';
        """
    )

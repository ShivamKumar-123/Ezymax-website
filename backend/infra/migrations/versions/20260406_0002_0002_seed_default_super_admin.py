"""Ensure default super_admin exists (fixes admin panel login when DB had no init-db seed).

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Same as init-db.sql — bcrypt for password: TrustEdgeAdmin2025!
_DEFAULT_HASH = "$2b$12$OV1PUf7jA8E22RQ184o0n.KkEjbSriZbLaDqO4SJGj/bjleK37Zh2"


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO users (email, password_hash, first_name, last_name, role, status, kyc_status)
        VALUES (
            'admin@trustedge.com',
            '{_DEFAULT_HASH}',
            'Super',
            'Admin',
            'super_admin',
            'active',
            'approved'
        )
        ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            status = EXCLUDED.status,
            kyc_status = EXCLUDED.kyc_status,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM users
        WHERE email = 'admin@trustedge.com'
          AND password_hash = '"""
        + _DEFAULT_HASH
        + """';
        """
    )

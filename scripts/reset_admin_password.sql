-- Run on VPS if admin login returns 401 (password unknown or old seed hash).
-- Password after this update: TrustEdgeAdmin2025!
-- docker compose exec -T postgres psql -U trustedge -d trustedge -f - < scripts/reset_admin_password.sql
UPDATE users
SET password_hash = '$2b$12$OV1PUf7jA8E22RQ184o0n.KkEjbSriZbLaDqO4SJGj/bjleK37Zh2'
WHERE email = 'admin@trustedge.com';

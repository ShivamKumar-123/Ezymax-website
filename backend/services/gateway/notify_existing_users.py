"""One-off: email existing users a "log in here" notice.

Context: the marketing site (fxartha.com) is now invite-only — new visitors
see only "Join Waitlist", no prominent Login button. Existing users should be
told they can still log in at trade.fxartha.com/auth/login. This script sends
that notice.

SAFE BY DEFAULT — running it with no flags only PRINTS the recipient count and
a sample; it sends nothing. You must pass --send to actually email people.

Run inside the gateway container (has DB + email provider env):

    # 1) See how many users would be emailed (sends nothing):
    docker compose exec gateway python services/gateway/notify_existing_users.py

    # 2) Send ONE test to yourself first:
    docker compose exec gateway python services/gateway/notify_existing_users.py --test you@example.com

    # 3) Real send to everyone (optionally cap with --limit for a first batch):
    docker compose exec gateway python services/gateway/notify_existing_users.py --send
    docker compose exec gateway python services/gateway/notify_existing_users.py --send --limit 100
"""
import argparse
import asyncio

from sqlalchemy import select, func

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import User
from packages.common.src.config import get_settings
from packages.common.src.smtp_mail import send_email, email_configured
from packages.common.src.email_templates import render_existing_user_login_notice

WALLET_PLACEHOLDER = "%@wallet.fxartha.local"


def _eligible_query():
    """Real, active end-user accounts — excludes demo, staff, and the
    wallet-first placeholder emails that can't receive mail."""
    return (
        select(User)
        .where(
            User.role == "user",
            User.status == "active",
            User.is_demo.is_(False),
            User.email.isnot(None),
            User.email.notlike(WALLET_PLACEHOLDER),
        )
        .order_by(User.created_at.asc())
    )


async def _count(db) -> int:
    q = _eligible_query()
    return (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0


def _trader_url() -> str:
    return getattr(get_settings(), "TRADER_APP_URL", "https://trade.fxartha.com")


async def dry_run() -> None:
    async with AsyncSessionLocal() as db:
        total = await _count(db)
        rows = (await db.execute(_eligible_query().limit(10))).scalars().all()
    print(f"[dry-run] email provider configured: {email_configured()}")
    print(f"[dry-run] eligible recipients: {total}")
    print("[dry-run] sample (first 10):")
    for u in rows:
        print(f"    - {u.email}  ({(u.first_name or '').strip()} {(u.last_name or '').strip()})".rstrip())
    print("\nNothing was sent. Re-run with --send to email everyone, "
          "or --test you@example.com to preview one.")


async def send_test(to_email: str) -> None:
    subject, html, text = render_existing_user_login_notice(full_name=None, trader_app_url=_trader_url())
    ok = await send_email(to_email, subject, html, text=text)
    print(f"[test] sent to {to_email}: {'OK' if ok else 'FAILED'}")


async def send_all(limit: int | None, batch: int, delay: float) -> None:
    if not email_configured():
        print("[send] ABORT — no email provider configured (RESEND/SENDGRID/SMTP).")
        return

    trader_url = _trader_url()
    async with AsyncSessionLocal() as db:
        q = _eligible_query()
        if limit:
            q = q.limit(limit)
        users = (await db.execute(q)).scalars().all()

    total = len(users)
    print(f"[send] emailing {total} users (batch={batch}, delay={delay}s)…")
    sent = failed = 0

    async def one(u: User) -> bool:
        name = f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip() or None
        subject, html, text = render_existing_user_login_notice(full_name=name, trader_app_url=trader_url)
        try:
            return await send_email(u.email, subject, html, text=text)
        except Exception:
            return False

    for i in range(0, total, batch):
        chunk = users[i : i + batch]
        results = await asyncio.gather(*(one(u) for u in chunk))
        sent += sum(1 for r in results if r)
        failed += sum(1 for r in results if not r)
        print(f"[send] progress {min(i + batch, total)}/{total} — sent={sent} failed={failed}")
        if i + batch < total:
            await asyncio.sleep(delay)

    print(f"[send] DONE — sent={sent} failed={failed} of {total}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Email existing users a login notice.")
    ap.add_argument("--send", action="store_true", help="Actually send (default: dry-run only).")
    ap.add_argument("--test", metavar="EMAIL", help="Send a single preview email to this address.")
    ap.add_argument("--limit", type=int, default=None, help="Cap number of recipients (first N).")
    ap.add_argument("--batch", type=int, default=20, help="Emails per concurrent batch (default 20).")
    ap.add_argument("--delay", type=float, default=1.0, help="Seconds between batches (default 1.0).")
    args = ap.parse_args()

    if args.test:
        asyncio.run(send_test(args.test))
    elif args.send:
        asyncio.run(send_all(args.limit, args.batch, args.delay))
    else:
        asyncio.run(dry_run())


if __name__ == "__main__":
    main()

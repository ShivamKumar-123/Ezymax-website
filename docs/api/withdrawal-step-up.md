# Withdrawal step-up — client contract (web + mobile)

Status: server support shipped behind the `WITHDRAWAL_STEP_UP_REQUIRED` flag
(default **off**). Ship clients that implement this flow first, then turn the
flag on. While the flag is off the server ignores `step_up_challenge_id`, so
sending it is always safe.

## Summary

Every withdrawal request must carry a **verified, single-use step-up
challenge** for `action = "withdrawal"`:

* user has 2FA enabled → the challenge is proved with an **authenticator (TOTP) code**;
* otherwise → with a **6-digit code emailed** to the account's verified address.

The challenge is redeemed atomically inside the withdrawal's own database
transaction: if the withdrawal fails (validation, balance, KYC …) the challenge
is **not** burnt and can be retried within its window; if it succeeds the
challenge can never be used again.

Impersonation (admin "login as") sessions cannot start or verify step-up
challenges and cannot withdraw (HTTP 403).

## 1. Discover whether step-up is required

`GET /api/v1/auth/platform-status` (public)

```json
{ "maintenance_mode": false, "allow_withdrawals": true,
  "withdrawal_step_up_required": true, "...": "..." }
```

Clients should also handle the 403 codes in §4 even when the flag reads false
(it can be flipped at any time).

## 2. Start a challenge

`POST /api/v1/auth/step-up/start` — authenticated (cookie or `Authorization: Bearer`)

```json
{ "action": "withdrawal", "method": "auto" }
```

`method` may be `"auto"` (recommended), `"totp"` or `"email_otp"`
(`"otp_old_email"` is an alias). For withdrawals the server enforces the
policy: a 2FA user must use `totp`, a non-2FA user must use the email code;
anything else → `400`.

Response `200`:

```json
{
  "challenge_id": "6f0c…-uuid",
  "action": "withdrawal",
  "method": "totp",                     // or "otp_old_email"
  "expires_at": "2026-10-02T10:20:00+00:00",
  "target_email_masked": "a***e@example.com"   // email method only
}
```

Errors: `400` unknown action / method not allowed / no verified email and no
2FA (user must verify an email or enable 2FA first), `403` impersonation
session, `429` too many challenges (per-user cap: 10 / hour; per-IP 10 / 10 min),
`502/503` email could not be sent.

Starting a new challenge for the same action invalidates the previous one.
The challenge must be verified within **10 minutes** of `start`.

## 3. Verify the challenge

`POST /api/v1/auth/step-up/verify`

```json
{ "challenge_id": "6f0c…-uuid", "proof": { "code": "123456" } }
```

* TOTP challenge: `proof.code` (also accepted: `otp`, `totp_code`).
* Email challenge: `proof.otp` (also accepted: `code`).

Response `200`:

```json
{ "verified": true, "challenge_id": "6f0c…", "action": "withdrawal",
  "method": "totp", "verified_at": "…", "ttl_seconds": 300 }
```

Rules:

* 5 wrong attempts per challenge, then the challenge is burnt (start again).
* Per-user cap of 20 verify attempts / hour across challenges (fails closed if
  the server's Redis is unavailable → `503`, retry later).
* A TOTP code is accepted **once**: a code already used (e.g. for login a few
  seconds earlier) is refused — wait for the next 30-second code.
* After success the challenge must be redeemed within **5 minutes** (`ttl_seconds`).

## 4. Send the withdrawal

Add `step_up_challenge_id` to the withdrawal request:

| Endpoint | Body | Field |
|---|---|---|
| `POST /api/v1/wallet/withdraw` | JSON | `"step_up_challenge_id": "<uuid>"` |
| `POST /api/v1/wallet/withdraw/onchain` | JSON | `"step_up_challenge_id": "<uuid>"` |
| `POST /api/v1/wallet/withdraw/manual` | multipart/form-data | form field `step_up_challenge_id` |

When the flag is on and the challenge is missing or unusable the server
answers **HTTP 403** with one of these exact `detail` strings:

| `detail` | Meaning | Client action |
|---|---|---|
| `STEP_UP_REQUIRED` | no / malformed `step_up_challenge_id` | run §2–§3, resend with the id |
| `STEP_UP_INVALID` | unknown, another user's, another action, not verified, already used, or verified > 5 min ago | run §2–§3 again, resend |

A challenge id is single-use: after a **successful** withdrawal, start a new
challenge for the next one. After a **failed** withdrawal (any non-2xx other
than the two codes above) the same id may be retried within its 5-minute window.

## Reference flow (pseudo-code)

```text
status = GET /auth/platform-status
if status.withdrawal_step_up_required:
    c = POST /auth/step-up/start {action:"withdrawal", method:"auto"}
    code = prompt(c.method == "totp" ? "Authenticator code" : "Code sent to " + c.target_email_masked)
    POST /auth/step-up/verify {challenge_id:c.challenge_id, proof:{code:code, otp:code}}
    body.step_up_challenge_id = c.challenge_id
resp = POST /wallet/withdraw/onchain body
if resp.status == 403 and resp.detail in ("STEP_UP_REQUIRED","STEP_UP_INVALID"):
    repeat the step-up block, then resend once
```

The trader web app implements this in
`frontend/trader/src/components/security/StepUpDialog.tsx` (used by
`app/wallet/page.tsx`).

## Related auth contract changes (same release)

* `POST /auth/wallet/verify` accepts an optional `totp_code`. A wallet account
  with 2FA gets `400 "2FA code required"` — re-run the SIWE nonce/sign flow and
  resend with `totp_code` (the nonce is single-use).
* `POST /auth/email/verify-otp`: when the result `action` is `EMAIL_CHANGED`,
  all refresh tokens and all **other** sessions are revoked and a fresh refresh
  token is issued (cookie; with `x-token-delivery: json` also
  `refresh_token` / `refresh_expires_at` in the body). Mobile clients must
  store the new refresh token.
* `POST /auth/register/verify` accepts optional `password` (required when the
  pending signup was contested — send it always). `POST /auth/register/cancel`
  requires `otp`.
* Access tokens without a session id (`sid`) are rejected (401) — every token
  issued by login / refresh / register already carries one.

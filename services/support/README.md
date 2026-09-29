# support

Kalks support and notifications service (Rust, axum 0.8, sqlx 0.9, PostgreSQL) on `127.0.0.1:8100`.

- **Live chat with an AI help bot (D95, D124).** Claude answers first from the knowledge base, streaming. It hands over to human agents on request, when unsure, on complaints, payment and withdrawal problems, security concerns and anything that needs an account action. Agents see the transcript and a user context panel.
- **Notification centre (D37, D41).** Per-client and per-staff inboxes, read / unread, preferences (in-app / email / phone push per topic), realtime push, email through the SMTP relay, mobile push through the Expo push service, Back Office broadcasts to segments, and an ingestion endpoint other services call: `POST /v1/notify`.

## Run locally

```bash
cargo run -p support        # http://127.0.0.1:8100 (BFFs and internal services only)
cargo test -p support       # unit tests + end-to-end flows against a throw-away database on :5433
```

It creates `kalks_support` and runs migrations on first start, then seeds the knowledge base (the help articles in `kb/help.md` and the Academy glossary `content/academy/en/glossary.yaml`). Settings come from the repo-root `.env.local`; the Claude key from `.env.claude` (`ANTHROPIC_API_KEY`). Without a key the bot answers from the best-matching article and hands over when it isn't confident. Without `SMTP_HOST`, emails are logged as `DEV email`.

The Client Area and Back Office need `SUPPORT_URL` (default `http://127.0.0.1:8100`) and `SUPPORT_INTERNAL_TOKEN` in their `.env.local`. In development the browser opens the stream on the service directly (`ws://127.0.0.1:8100/v1/stream`); in production it opens `wss://<app or admin host>/support/stream` (Caddy rewrites to `/v1/stream`). `SUPPORT_STREAM_URL` overrides this.

| Variable | Default | |
|---|---|---|
| `SUPPORT_BIND` | `127.0.0.1:8100` | |
| `SUPPORT_DATABASE_URL` | `postgres://postgres@127.0.0.1:5433/kalks_support` | created on first start |
| `SUPPORT_INTERNAL_TOKEN` | – | required when `SUPPORT_ENV=production` |
| `SUPPORT_STORAGE_DIR` | `~/.kalks-data/support` | chat attachments (0600 files, outside any web root) |
| `SUPPORT_MAX_ATTACHMENT_MB` | `10` | images (PNG, JPG, GIF, WEBP) and PDF only, type sniffed from the bytes |
| `ANTHROPIC_API_KEY` | – | Claude key (`.env.claude`) |
| `SUPPORT_AI_MODEL` | `claude-opus-5-5` | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | port `587` | same relay as the gateway; no user = IP-allowlisted relay (smtp-relay.gmail.com:587 STARTTLS in production) |
| `SUPPORT_APP_URL` / `SUPPORT_ADMIN_URL` | `http://localhost:3000` / `:3001` | links in emails |
| `GATEWAY_URL` + `GATEWAY_INTERNAL_TOKEN` | `:8080` | client profile, KYC, email addresses, broadcast segments |
| `TRADING_URL` + `TRADING_INTERNAL_TOKEN` | `:8090` | accounts in the context panel; trading adapters |
| `WALLET_URL` + `WALLET_INTERNAL_TOKEN` | `:8095` | wallet in the context panel; wallet adapter |
| `SUPPORT_WORKERS` / `SUPPORT_ADAPTERS` | `true` | email outbox + SLA sweeps / polling adapters |
| `SUPPORT_ADAPTER_SECS` | `15` | |
| `SUPPORT_PUSH_ENABLED` | on in production (`SUPPORT_ENV=production`), off otherwise | mobile push (below) |
| `SUPPORT_EXPO_PUSH_URL` | `https://exp.host/--/api/v2/push` | `/send` and `/getReceipts` under it |
| `SUPPORT_EXPO_ACCESS_TOKEN` | – | only when the Expo project turns on "enhanced push security" |
| `SUPPORT_PUSH_RECEIPT_DELAY_SECS` | `900` | how long after sending the delivery receipt is checked |

## Chat model

A conversation is `bot` (the AI answers) → `waiting` (handed over; first-response SLA runs) → `assigned` (an agent owns it; a reply SLA runs while the client waits) → `resolved` (the client can rate it 1–5 within 7 days). A client has at most one open conversation. With **AI autopilot** off (Back Office → Support → CSAT → Desk settings) new chats go straight to `waiting`. SLA breaches raise a critical staff notification.

Messages are `client`, `bot`, `agent`, `system` (joins, handovers, ratings) and `note` (internal, never sent to the client). Bot messages carry `meta.cites` (articles used), `meta.confidence` (retrieval score), `meta.engine` (`claude`, `fallback` or `rules`).

**The bot** (`src/bot.rs`): BM25 retrieval over title, tags and body (`src/kb.rs`) picks up to 5 articles; Claude (`POST /v1/messages`, streaming, effort `low`, cached system prompt, server-side refusal fallback) answers only from them and ends with `[[HANDOVER: reason]]` / `[[SOURCES: slugs]]` markers that are stripped before the client sees them. Deterministic rules hand over before Claude is called for "talk to a human", complaints, security concerns, payment problems and account actions. The bot sees only the knowledge base, the client's first name and this conversation: it has no tools and no account data, so it can't act on accounts or leak other clients' data. It never gives financial advice. Answers per client per hour are capped (`botPerHour`).

## API

Every route except `GET /health` and `GET /v1/stream` needs `X-Kalks-Internal: $SUPPORT_INTERNAL_TOKEN`. `X-Kalks-Tenant` (default `kalks`) scopes everything. Errors: `{"error": {"code", "message", "field"?}}`.

- **Client routes** take `X-Kalks-User-Id` (+ `X-Kalks-User-Name`, `X-Kalks-User-Email`, percent-encoded), set by the CRM BFF from the session cookie.
- **Staff routes** take `X-Kalks-Staff-Id`, `X-Kalks-Staff-Name` (percent-encoded), `X-Kalks-Staff-Role` and `X-Kalks-Staff-Perms` (comma-separated). Permissions: `support.read`, `support.write`, `notifications.write` (gateway RBAC keys; the admin BFF resolves them). Without `X-Kalks-Staff-Perms` the service falls back to role lists in `src/api/mod.rs`.

### Client (`/v1/support/me…`, CRM BFF `/api/support/*`)

| Method & path | Body | Response |
|---|---|---|
| `GET /v1/support/me` | – | `{settings:{botName, greeting, ai, agentsOnline, maxAttachmentMb}, conversation, messages[]}` (open conversation, else one resolved in the last 7 days) |
| `GET /v1/support/me/conversations` | – | `{items[]}` history |
| `GET /v1/support/me/conversations/{id}` | – | `{conversation, messages[]}` |
| `POST /v1/support/me/messages` | `{body, attachmentId?}` | `{conversation, message}`; opens a conversation if none is open; the bot answers over the stream |
| `POST /v1/support/me/handover` | `{reason?}` | `{conversation}` |
| `POST /v1/support/me/conversations/{id}/resolve` | – | `{conversation}` |
| `POST /v1/support/me/conversations/{id}/rate` | `{rating: 1-5, comment?}` | `{conversation}` (409 `not_resolved` before the chat ends) |
| `POST /v1/support/me/read`, `/typing` | – | `{status}` |
| `POST /v1/support/me/attachments` | raw file, `X-File-Name` | `{attachment:{id, name, mime, size}}` (413 / 415) |
| `GET /v1/support/me/attachments/{id}` | – | the file (own files only; `nosniff`, `default-src 'none'`) |
| `GET /v1/notifications/me?before&limit&unread` | – | `{items[], unread, next}` |
| `POST /v1/notifications/me/read` | `{ids?:[], all?:true}` | `{unread}` |
| `POST /v1/notifications/me/clear` | – | `{unread:0}` |
| `GET` / `PUT /v1/notifications/me/prefs` | `{prefs:{key:{inApp?, email?, push?}}}` | `{catalog[], prefs}` |
| `POST /v1/push/tokens` | `{token, deviceId, platform: ios\|android, locale?, appVersion?}` | `{status, enabled}`: registers or refreshes this phone for the client (mobile push, below) |
| `POST /v1/push/tokens/delete` | `{token}` | `{removed}`: the client's own row (sign-out on the phone) |

### Back Office (`/v1/support/admin…`, admin BFF `/api/support/*`)

| Method & path | Permission | |
|---|---|---|
| `GET /conversations?queue=bot\|waiting\|mine\|open\|resolved&q&user_id` | read | `{items, counts:{bot, waiting, mine, open, breached}, me, agentsOnline}` |
| `GET /conversations/{id}` | read | `{conversation, messages (incl. notes), history}` |
| `GET /conversations/{id}/context` | read | user context panel: gateway profile + KYC, engine accounts + summary, wallet balances + recent activity, support history |
| `POST /conversations/{id}/messages` | write | `{body, note?, attachmentId?}`; replying takes an unowned chat |
| `POST /conversations/{id}/takeover`, `/assign {staffId}`, `/resolve`, `/reopen` | write | audited |
| `PUT /conversations/{id}/tags` | write | `{tags[], priority?: normal\|high}` |
| `POST /conversations/{id}/read`, `/typing`, `/attachments` | read / write | |
| `GET /attachments/{id}` | read | |
| `GET /agents`, `PUT /me/status {online\|away}` | read | |
| `GET`/`POST /canned`, `PUT`/`DELETE /canned/{id}`, `POST /canned/{id}/use` | read / write | variables `{{first_name}}`, `{{agent_name}}`, `{{client_id}}` |
| `GET`/`POST /kb`, `GET`/`PUT`/`DELETE /kb/{id}`, `POST /kb/test {question}` | read / write | the bot uses edits from the next question |
| `GET /stats?days` | read | queue now, first response vs SLA, SLA met %, AI containment, CSAT average / distribution, per-day series, per-agent table, latest ratings |
| `GET`/`PUT /settings` | read / write | `{autopilot, botName, greeting, slaFirstSecs, slaReplySecs, botPerHour, emailReplies}` |
| `GET /audit` | read | append-only |
| `GET /v1/notifications/staff/me`, `POST …/read`, `…/clear` | any staff | the staff bell |
| `GET`/`POST /v1/notifications/admin/broadcasts`, `POST …/preview {segment}` | notifications.write | broadcasts (below) |

### Realtime stream

`POST /v1/stream/ticket` (client or staff headers) → `{ticket, expiresIn: 30}`; the browser opens `GET /v1/stream?ticket=…` (one-time). Frames: `hello {who, unread}`, `message`, `conversation`, `bot.typing`, `bot.delta {conversationId, streamId, text}`, `typing {from}`, `notification {item, unread}`, `notifications.read {unread}`, `resync`, `ping`. Clients receive only their own conversation (never notes) and notifications; staff with `support.read` receive every inbox event plus their own notifications; other staff only their own notifications.

## Notifications API (for other services)

`POST /v1/notify` with `X-Kalks-Internal`, optional `X-Kalks-Tenant` and `X-Kalks-Service: wallet|kyc|prop|ib|…` (stored as the source).

```json
{
  "type": "wallet.deposit_credited",
  "userId": 42,
  "title": "Deposit credited",
  "body": "250.00 USDT was credited to your wallet.",
  "link": "/wallet/history",
  "severity": "success",
  "data": {"depositId": 991},
  "dedupeKey": "deposit:991:credited"
}
```

- Recipients: `userId` or `userIds` (clients), `staffId` or `staffIds` (staff); at most 1000 per call.
- `type` is `category.event`, lower-case. The category decides the preference topic: `security.*` (always on), `trading.margin_call` / `trading.stop_out` (margin call and stop-out), other `trading.*` (fills and closes), `wallet.*`, `kyc.*`, `ib.*`, `copy.*` / `pamm.*`, `prop.*`, `support.*`, `marketing.*`, anything else = platform notices.
- `severity`: `info` (default), `success`, `warning`, `critical`. `link`: an app path (`/wallet`) or `https://` URL.
- `dedupeKey` makes the call idempotent per recipient (safe to retry; a repeat returns `duplicate: true`).
- Email follows the recipient's preference for the topic; `"email": false` sends in-app only (use it when your service already emails). `emailTo` skips the gateway lookup; `emailSubject` overrides the subject.
- Response: `{"results": [{"audience", "recipient", "id", "duplicate", "inApp", "emailed", "pushed"}]}` (`pushed` = phones the mobile push was queued for).

```bash
curl -s localhost:8100/v1/notify -H "x-kalks-internal: $SUPPORT_INTERNAL_TOKEN" -H "x-kalks-service: wallet" \
  -H 'content-type: application/json' -d '{"type":"wallet.deposit_credited","userId":42,"title":"Deposit credited","dedupeKey":"deposit:991"}'
```

Producers that push directly (each from an outbox written with the business change, delivered after the commit with retries, so a support outage never blocks money movement):

| Service | Types | Dedupe key | Link |
|---|---|---|---|
| wallet | every wallet notification: `wallet.deposit_credited`, `wallet.deposit_rejected`, `wallet.withdrawal_requested`, `wallet.withdrawal_approved`, `wallet.withdrawal_rejected`, `wallet.withdrawal_completed`, `wallet.transfer_completed`, `wallet.credit` | `wallet:n:<wallet notification id>` | `/wallet/history`, `/wallet` |
| prop | `prop.passed`, `prop.failed` (breach), `prop.funded`, `prop.phase_started`, `prop.scaled`, `prop.loss_warning`, `prop.violation`, `prop.payout_requested`, `prop.payout_paid`, `prop.payout_rejected` | `prop:n:<prop notification id>` | `/prop/mine`, `/prop/payouts` |
| ib | `ib.commission_paid` (a payout landed in the partner's wallet) | `ib:payout:<payout id>:paid` | `/partner/payouts` |
| news | `calendar.reminder` (in-app) | per event and user | `/calendar` |

Polling adapters (`src/adapters.rs`) cover the rest: engine closing deals (`trading.stop_out`, `trading.sl`, `trading.tp`, `trading.dealer_close`), engine margin-call flags (`trading.margin_call`) and gateway KYC decisions (`kyc.verified`, `kyc.rejected`, in-app only because the gateway emails them). The wallet adapter (wallet notifications of clients seen on the stream in the last 24 hours) stays as a safety net and uses the wallet's dedupe key, so nothing is shown twice. Each adapter starts from "now" on its first run. Copy/PAMM should call `POST /v1/notify` at the moment of the event too.

### Mobile push

The Kalks app (apps/mobile) registers the phone's Expo push token for the signed-in client through the Client Area BFF
(`POST /api/mobile/push/register`: never for view-only logins or staff sessions), and removes it when the client signs
out on the phone: `POST /v1/push/tokens/delete` with the session, or, when the session already ended,
`POST /v1/push/tokens/forget {token, deviceId}` (service route; the phone proves it registered the row with both its
push token and its installation id). One row per phone: a sign-in by someone else on the same phone moves the row, and
pushes still queued for the previous client are dropped. At most 10 phones per client.

`deliver` (every producer: `/v1/notify`, adapters, support replies, broadcasts) queues a push for each of the client's
phones seen in the last 90 days when the in-app notification is on for the category and so is its `push` preference.
`push` defaults to on for every category except News and offers (marketing pushes are opt-in, App Store guideline
4.5.4); security can't be switched off. Staff never get phone pushes. The message is the notification's title and body
(shortened to fit 4 KB) with `data: {id, type, link, uid}`, the unread count as the iOS badge, and an Android channel:
`alerts` (security, margin call, stop-out and price alerts), `news` (marketing) or `activity`.

`src/push.rs`, behind `SUPPORT_PUSH_ENABLED`:
- **Sender** (woken on every queued push, else every 5 s): due rows in batches of 100 (Expo's limit) to `/send`, leased
  for two minutes so an overlapping sender can't take them. Per ticket: `ok` keeps the ticket id; `DeviceNotRegistered`
  removes the phone; `MessageRateExceeded`, HTTP 429 / 5xx / 401 and network errors retry after 15 s, doubling up to
  30 min, 8 tries; any other error fails the message. A request refused as a whole (400 / 413) is sent again one message
  at a time.
- **Receipts** (every minute): `/getReceipts` for tickets older than `SUPPORT_PUSH_RECEIPT_DELAY_SECS`, 1000 ids per call.
  `DeviceNotRegistered` removes the phone, `MessageRateExceeded` sends the message again after the backoff.
- **Clean-up** (every 10 minutes): messages still pending after a day fail, finished rows go after 7 days, phones not
  seen for 90 days are removed.

### Broadcasts

`POST /v1/notifications/admin/broadcasts` `{title, body, link?, category: "system"|"marketing"|"security", segment, inApp, email}` with `segment` = `{kind: "all"}`, `{kind: "kyc_verified"}`, `{kind: "kyc_unverified"}`, `{kind: "countries", countries: ["ae","in"]}` or `{kind: "users", userIds: [..]}` (active gateway clients of the tenant). Sent in the background (status `sending` → `sent`), respecting each client's preferences, deduplicated per broadcast, and audited.

## Data

`conversations`, `messages`, `attachments`, `canned_replies`, `kb_articles`, `agents`, `notifications` (unique `(tenant, audience, recipient, dedupe_key)`), `notification_prefs`, `broadcasts`, `email_outbox` (sent in the background, 5 attempts), `push_tokens` (unique `(tenant, token)`), `push_outbox` (one row per notification and phone: ticket, receipt, attempts), `settings`, `cursors`, `audit_log` (append-only, trigger).

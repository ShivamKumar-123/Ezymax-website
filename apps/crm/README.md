# Client Area (apps/crm)

Next.js app on http://localhost:3000. Live builds (default) show real data only. Demo builds (`NEXT_PUBLIC_KALKS_MODE=demo`) show the mock showcase. Design rules are in `docs/CONVENTIONS.md`.

## Trading accounts (live builds)

`/accounts`, `/accounts/new`, `/accounts/[login]`, `/portfolio`, `/portfolio/history`, `/portfolio/ledger` and `/portfolio/statements` read from the trading engine (`services/trading`, see its README "Client Area API"). They go through the BFF at `app/api/trading/[...path]/route.ts`:

- The client is resolved on the server from the HttpOnly `kalks_session` cookie, using the gateway's `/v1/auth/me`. The engine receives that id in `X-Kalks-User-Id`. The BFF never uses a user id sent by the browser.
- CSRF protection: POSTs must be JSON and carry a same-origin `Origin` header.
- Dealer-only fields (route, book, execution delay, markup) are stripped before responses reach the browser.
- The engine's internal token stays on the server.

| BFF route | Engine |
|---|---|
| `GET groups` | `GET /v1/groups` |
| `GET / POST accounts` | `GET / POST /v1/accounts` (generated passwords are returned once and never stored) |
| `GET accounts/{login}` | `GET /v1/accounts/{login}` |
| `GET accounts/{login}/history`, `…/ledger` (`from`, `to`, `page`, `limit`) | same paths |
| `GET accounts/{login}/export?kind=history\|ledger&from&to` | CSV statement built from the paged engine routes |
| `POST accounts/{login}/demo-refill` | same path |
| `POST accounts/{login}/passwords`, `…/leverage` (need `stepup_token`, see below) | same paths |
| `POST accounts/{login}/sso` | `POST /v1/accounts/{login}/sso`, returns `{url, expiresAt}` |

### Email-code confirmation (D20)

Trading and investor password changes, leverage changes and the Client Area password change need a 6-digit code emailed to the client, even inside a session:

1. `POST /api/auth/stepup {action, target}` emails the code (`action`: `trading_password`, `investor_password`, `leverage`, `account_password`, `withdrawal`, …; `target`: the account login where it applies). Resend with `POST /api/auth/stepup-resend {challenge}`.
2. `POST /api/auth/stepup-verify {challenge, code, action, target}` returns `stepup_token`: single use, valid for 5 minutes, bound to the client, the action and the target.
3. The change request carries `stepup_token` (body field, or the `X-Kalks-Stepup` header). The trading BFF checks the request against the account first, then redeems the token with the gateway (`POST /v1/auth/stepup/consume`, server to server only) and only then calls the engine. Without a valid token it answers 403 `stepup_required` / `stepup_invalid`.

The Client Area password is changed with `POST /api/auth/password {current, new, stepup_token, sign_out_others}` (gateway `POST /v1/auth/password`). UI: `components/stepup.tsx` (`useStepUp`, `StepUpCode`, `StepUpDialog`).

### Kalks Trader SSO

The Trade button opens `NEXT_PUBLIC_TERMINAL_URL + "/?sso=<token>"`. The token is one-time and valid for 60 s. Kalks Trader redeems it through its own BFF with `POST /v1/terminal/sso {token}`, stores the resulting session and removes `sso` from the URL.

## Environment

These go in `apps/crm/.env.local` for local runs, or `apps/crm/.env.production.local` in production:

| Variable | |
|---|---|
| `GATEWAY_URL`, `GATEWAY_INTERNAL_TOKEN` | gateway (sign-in, session check) |
| `TRADING_URL` | trading engine, default `http://127.0.0.1:8090` |
| `TRADING_INTERNAL_TOKEN` | same value as the engine's `TRADING_INTERNAL_TOKEN` (repo-root `.env.local` / server env) |
| `NEXT_PUBLIC_TERMINAL_URL` | Kalks Trader origin, for example `https://trade.kalkstrade.com` (build time) |

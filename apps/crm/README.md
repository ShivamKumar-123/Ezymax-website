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
| `POST accounts/{login}/demo-refill`, `…/passwords`, `…/leverage` | same paths |
| `POST accounts/{login}/sso` | `POST /v1/accounts/{login}/sso`, returns `{url, expiresAt}` |

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

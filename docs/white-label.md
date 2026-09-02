# White-Label Brokers (rental model)

SwissCresta can be rented out to partner brokers under **their own brand**:
their own user pool, their own branding (name / logo / support contacts),
optionally their own domain — while the platform owner keeps full control
and charges a flat rental fee. The design is a faithful port of the
Stock4x tenant system, minus its P&L-share/settlement economics.

## Concepts

| Term | Meaning |
|---|---|
| **Broker** | A `users` row with `role='broker'` + a `broker_profiles` row. Logs into the **admin panel** with a scoped, permission-gated view. |
| **Pool** | Every user whose `broker_ancestry` array contains the broker's id — covers sub-brokers and their clients via one GIN-indexed query. |
| **Platform pool** | Users with `assigned_broker_id IS NULL` (plain swisscresta.com signups). |
| **Partner code** | `WL-XXXXXXXX` — the broker's signup handle. `?ref=<code>` links (and signups on the broker's domain) drop the user into the broker's pool. Distinct from IB referral codes. |
| **Rental terms** | Plan label, amount/currency/period, next-due date, notes — record-keeping on the broker profile, editable only by the super-admin. Suspension freezes the tenant's admin access + branding instantly. |

## Permission model

Brokers get tri-state grants (`off` / `view` / `edit`) per admin section:
`users, kyc, deposits, withdrawals, trades, transactions, sub_brokers`.

* `off` — section hidden, backend 403s.
* `view` — read-only lists/details, always filtered to the broker's pool.
* `edit` — mutations too (approve deposits, block users, …), each guarded
  by `assert_broker_scope` so cross-tenant targets 403.
* `sub_brokers=edit` lets a broker mint nested sub-brokers — never with
  permissions above its own (cap validation + downgrade cascade).
* Destructive platform powers (delete user, impersonate, kill switch,
  stealth trades) are **never** grantable to brokers.

Platform behaviour is unchanged: super-admin and employees see everything
exactly as before; broker rows are hidden from the trading-users list and
managed on the **Brokers** page (super-admin only).

## Custom-domain lifecycle

```
set domain → pending_dns → (verify: A records == PLATFORM_PUBLIC_IP)
          → dns_verified → provisioning (nginx block + certbot --nginx)
          → ready | failed
```

* **Apex mode** (no subdomain): platform serves `brand.com` + `www.brand.com`.
* **Subdomain mode**: platform serves only `<sub>.brand.com`; the apex
  stays free for the broker's own landing page.
* **Admin panel**: every connected domain ALSO serves the broker's
  (scoped) admin panel on `admin.<domain>` — same certificate, second
  nginx block → `BRANDING_ADMIN_UPSTREAM`. The DNS wizard requires the
  `admin.` A record too. Login isolation: on `admin.<domain>` only that
  broker (and its sub-brokers, plus the platform super-admin) can sign
  in; once a broker's domain is live, the platform's admin host refuses
  their login and points them at their own portal. `admin` and `www`
  are reserved app-subdomain labels.
* Tenant login isolation: a login on `brand.com` only admits users in
  that broker's pool (`user_belongs_to_owner`); platform hosts fail open.
* The gateway's same-origin guard accepts live tenant domains via a 60s
  cached allow-list (`active_tenant_hosts`).

## Server setup (one-time, production)

1. Set in `.env`: `BRANDING_ENABLED=true`, `PLATFORM_PUBLIC_IP=<origin ip>`,
   `BRANDING_NGINX_TENANTS_FILE=/etc/nginx/conf.d/swisscresta-tenants.conf`,
   `BRANDING_TRADER_UPSTREAM=127.0.0.1:3012`,
   `BRANDING_ADMIN_UPSTREAM=127.0.0.1:3013`.
2. `touch /etc/nginx/conf.d/swisscresta-tenants.conf` and ensure nginx's
   `http {}` block includes `conf.d/*.conf` (default on Debian/Ubuntu).
3. **Install the host domain agent** (the admin-api container cannot run
   host nginx/certbot; the agent completes provisioning within a minute):
   ```
   sudo ./scripts/install-wl-agent-cron.sh
   ```
   Log: `/var/log/swisscresta-wl-agent.log`. The agent also reconciles
   Disconnects (removes the nginx block + deletes the certificate).
4. Migrations 0062/0063 run via `deploy.sh`; the admin service also
   bootstraps the DDL idempotently on start.
5. Tenant DNS must be **direct** (Cloudflare grey-cloud / "DNS only")
   during verification + SSL issuance; the proxy may be re-enabled once
   the domain shows Live.

## Flow (how to rent the platform out)

1. Admin panel → **Brokers** → *Add Broker*: email/password, brand name,
   permissions, rental terms. Copy the partner code / referral link.
2. Give the broker their admin login (`admin.swisscresta.com`). They see
   only the sections granted, scoped to their pool, plus a **Branding**
   page.
3. Broker (or super-admin via the Brokers page) uploads logo, sets brand
   name + support contacts, connects their domain, points DNS, verifies.
4. Users signing up through `?ref=<code>` or on the broker's domain land
   in the broker's pool; the trader app chrome (title/favicon/logo) swaps
   to the broker's brand on their domain (`BrandingProvider`).
5. Rent falls due → super-admin tracks it on the Brokers page
   (next-due date); a non-paying tenant is **Suspended** (one click):
   broker admin login refused, branding falls back to platform, pool
   users keep trading unless explicitly blocked.

## Key files

* `backend/packages/common/src/models/broker.py` — BrokerProfile model.
* `backend/packages/common/src/broker_tenancy.py` — scoping, isolation,
  attribution, brand resolution (the core).
* `backend/services/admin/routes/brokers.py` + `services/broker_service.py`
  — tenant CRUD, permissions, rental, suspension.
* `backend/services/admin/routes/branding_admin.py` +
  `services/branding_admin_service.py` + `services/branding_provisioner.py`
  — branding, domain lifecycle, nginx/certbot provisioning.
* `backend/services/gateway/src/api/branding.py` — public
  `/branding/by-domain`, authed `/branding/me`, logo serving.
* Gateway auth: `apply_tenant_attribution` (signup pool assignment),
  `user_belongs_to_owner` check in login, `assert_same_origin_or_tenant`.
* `frontend/admin`: `/brokers` page, `/branding` page, sidebar + route
  permission gating (`_broker`, `sub_brokers.view`).
* `frontend/trader/src/components/providers/BrandingProvider.tsx` —
  per-host brand resolution + chrome swap.

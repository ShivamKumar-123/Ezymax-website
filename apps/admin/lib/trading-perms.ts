/**
 * Back Office trading permissions (dealing desk, trading accounts, groups).
 *
 * The gateway's role → permission matrix (services/gateway/src/admin.rs) has no trading permissions yet, so
 * the admin BFF owns this map. It mirrors the role checks the trading engine enforces itself
 * (services/trading/src/api/mod.rs: ROLES_DEALING / ROLES_FINANCE / ROLES_CONFIG); the BFF checks first so a
 * role never reaches the engine for something it may not do, and the UI hides what the role can't use.
 *
 * When the gateway starts returning trading permissions for a role (any "dealing.*" entry in
 * `/v1/admin/auth/me` → permissions), that list wins and this map is no longer consulted.
 *
 * | permission       | what it allows                                                             | roles                                              |
 * |------------------|----------------------------------------------------------------------------|----------------------------------------------------|
 * | dealing.read     | positions, orders, deals, controls, routing, dealing audit, live stream    | every staff role except marketing, partner_manager |
 * | dealing.write    | dealer trades, modify / close / transfer / void / reopen, symbol & account | platform_owner, super_admin, admin, dealer,        |
 * |                  | controls, routing rules and quick routes                                   | risk_manager                                       |
 * | dealing.policy   | tenant policy (execution-delay switch and cap, margin call / stop-out)     | platform_owner, super_admin, admin                 |
 * | accounts.read    | trading account list / detail, history, ledger, groups (read)              | same as dealing.read                               |
 * | accounts.write   | account status, group change, leverage                                     | same as dealing.write                              |
 * | finance.adjust   | add / deduct funds (Balance & credit, wallet service) and account bonus     | platform_owner, super_admin, admin, finance        |
 * | groups.write     | create / edit account groups                                               | platform_owner, super_admin, admin                 |
 */

export const TRADING_PERMS = ["dealing.read", "dealing.write", "dealing.policy", "accounts.read", "accounts.write", "finance.adjust", "groups.write"] as const;
export type TradingPerm = (typeof TRADING_PERMS)[number];

const READERS = ["platform_owner", "super_admin", "admin", "dealer", "risk_manager", "compliance", "finance", "support", "viewer"];
const DEALING = ["platform_owner", "super_admin", "admin", "dealer", "risk_manager"];
const FINANCE = ["platform_owner", "super_admin", "admin", "finance"];
const CONFIG = ["platform_owner", "super_admin", "admin"];

export const TRADING_ROLE_MAP: Record<TradingPerm, readonly string[]> = {
  "dealing.read": READERS,
  "dealing.write": DEALING,
  "dealing.policy": CONFIG,
  "accounts.read": READERS,
  "accounts.write": DEALING,
  "finance.adjust": FINANCE,
  "groups.write": CONFIG,
};

export const isTradingPerm = (p: string): p is TradingPerm => (TRADING_PERMS as readonly string[]).includes(p);

/** Whether a staff member (role + gateway permission list) holds a trading permission. */
export function tradingAllows(staff: { role: string; permissions?: string[]; rbac?: boolean }, perm: TradingPerm): boolean {
  if (staff.rbac) return staff.permissions?.includes(perm) ?? false;
  const fromGateway = staff.permissions?.some((p) => p.startsWith("dealing."));
  if (fromGateway) return staff.permissions!.includes(perm);
  return TRADING_ROLE_MAP[perm].includes(staff.role);
}

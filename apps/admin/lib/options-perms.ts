/**
 * Back Office FX OPTIONS permissions (Options section: risk desk, series, vol surfaces, rates, holidays, spreads /
 * fees / limits, market maker, order books, dealer controls, clearing & liquidations, settlements, book rollout,
 * broker switches, audit — services/options and the trading engine's option book and order books).
 *
 * The gateway (services/gateway/src/rbac.rs) is the source of truth: `/v1/admin/auth/me` returns these keys with
 * `rbac: true`, and the BFFs (/api/options, the option routes of /api/trading) check them before calling a service.
 * The role map below is only the fallback for gateways that predate the options keys.
 *
 * | permission      | what it allows                                                                          | roles                                            |
 * |-----------------|-----------------------------------------------------------------------------------------|--------------------------------------------------|
 * | options.read    | every Options page: risk desk, series, surfaces, rates, holidays, controls, settlements, | platform_owner, super_admin, admin, dealer,      |
 * |                 | market maker status and settings, order-book monitor and halts, clearing accounts,     | options_risk                                     |
 * |                 | liquidation log, pending four-eyes approvals, the book-rollout plan (dry run)           |                                                  |
 * | options.config  | underlyings (incl. order-book tick / bands / liquidation / RFQ / mark parameters), vol  | platform_owner, super_admin, admin, options_risk |
 * |                 | surface publish, rates, holidays, group spreads / fees (maker rebate, taker fee) /      |                                                  |
 * |                 | limits, market-maker quoting settings, the listing run and the per-broker module        |                                                  |
 * |                 | switches (Ezymex only, checked by the service)                                           |                                                  |
 * | options.dealing | halt / close-only / freeze / manual vol, per-client limits, void option trades; order   | platform_owner, super_admin, admin, dealer,      |
 * |                 | book halt / cancel-only and clearing them, market-maker pause / resume, and the depth   | options_risk                                     |
 * |                 | drill-down WITH OWNERS (an audited view)                                                |                                                  |
 * | options.settle  | re-fix an expiry and re-run its settlement within 1 hour of the first fixing; bust a    | platform_owner, super_admin, admin, options_risk |
 * |                 | book fill and enable the order book (both FOUR-EYES: a second staff member with this   |                                                  |
 * |                 | permission confirms)                                                                    |                                                  |
 *
 * Platform-wide data (underlyings, rates, holidays, surfaces, fixings, module switches) can only be changed by Ezymex
 * staff (tenant `ezymex`); the options service enforces that whatever the role. Market-maker settings for every broker
 * (`*`) or another broker are Ezymex staff's too (the BFF and the service check it).
 */

export const OPTIONS_PERMS = ["options.read", "options.config", "options.dealing", "options.settle"] as const;
export type OptionsPerm = (typeof OPTIONS_PERMS)[number];

const ALL = ["platform_owner", "super_admin", "admin", "options_risk"];
const DESK = [...ALL, "dealer"];

export const OPTIONS_ROLE_MAP: Record<OptionsPerm, readonly string[]> = {
  "options.read": DESK,
  "options.config": ALL,
  "options.dealing": DESK,
  "options.settle": ALL,
};

export const isOptionsPerm = (p: string): p is OptionsPerm => (OPTIONS_PERMS as readonly string[]).includes(p);

/** Whether a staff member (role + gateway permission list) holds an options permission. */
export function optionsAllows(staff: { role: string; permissions?: string[]; rbac?: boolean }, perm: OptionsPerm): boolean {
  if (staff.rbac) return staff.permissions?.includes(perm) ?? false;
  const fromGateway = staff.permissions?.some((p) => p.startsWith("options."));
  if (fromGateway) return staff.permissions!.includes(perm);
  return OPTIONS_ROLE_MAP[perm].includes(staff.role);
}

/** The platform broker: only its staff change platform-wide options data (the options service checks it too). */
export const PLATFORM_TENANT = "ezymex";

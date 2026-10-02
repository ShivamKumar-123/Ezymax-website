/**
 * Back Office FX OPTIONS permissions (Options section: risk desk, series, vol surfaces, rates, holidays, spreads /
 * fees / limits, dealer controls, settlements, broker switches, audit — services/options and the trading engine's
 * option book).
 *
 * The gateway (services/gateway/src/rbac.rs) is the source of truth: `/v1/admin/auth/me` returns these keys with
 * `rbac: true`, and the BFFs (/api/options, the option routes of /api/trading) check them before calling a service.
 * The role map below is only the fallback for gateways that predate the options keys.
 *
 * | permission      | what it allows                                                                          | roles                                            |
 * |-----------------|-----------------------------------------------------------------------------------------|--------------------------------------------------|
 * | options.read    | every Options page: risk desk, series, surfaces, rates, holidays, controls, settlements | platform_owner, super_admin, admin, dealer,      |
 * |                 |                                                                                         | options_risk                                     |
 * | options.config  | underlyings, vol surface publish, rates, holidays, group spreads / fees / limits, the   | platform_owner, super_admin, admin, options_risk |
 * |                 | listing run and the per-broker module switches (Kalks only, checked by the service)     |                                                  |
 * | options.dealing | halt / close-only / freeze / manual vol, per-client limits, void option trades           | platform_owner, super_admin, admin, dealer,      |
 * |                 |                                                                                         | options_risk                                     |
 * | options.settle  | re-fix an expiry and re-run its settlement within 1 hour of the first fixing             | platform_owner, super_admin, admin, options_risk |
 *
 * Platform-wide data (underlyings, rates, holidays, surfaces, fixings, module switches) can only be changed by Kalks
 * staff (tenant `kalks`); the options service enforces that whatever the role.
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
export const PLATFORM_TENANT = "kalks";

/**
 * Back Office Staking permissions (services/staking: plans, monthly rates, settlements, positions, audit).
 *
 * The gateway RBAC (services/gateway/src/rbac.rs) defines staking.read / write / approve / export and returns them in
 * the staff session (`rbac: true`); that list always wins, custom roles included. This map is the fallback for
 * sessions without RBAC and mirrors the service's own role fallback (services/staking/src/api/mod.rs). The BFF
 * forwards the resolved permissions to the staking service in `X-Ezymex-Staff-Perms`, which checks them again.
 *
 * | permission       | what it allows                                                              | roles                                        |
 * |------------------|-----------------------------------------------------------------------------|----------------------------------------------|
 * | staking.read     | every GET: overview, plans, rates, settlement previews and lists, positions, | platform_owner, super_admin, admin, finance, |
 * |                  | audit                                                                       | risk_manager, compliance                     |
 * | staking.write    | create and edit plans, set monthly rates, create a settlement               | platform_owner, super_admin, admin           |
 * | staking.approve  | approve, reject and retry a settlement (four-eyes: never the creator)       | platform_owner, super_admin, admin, finance  |
 * | staking.export   | the full positions export (audited)                                         | platform_owner, super_admin, admin           |
 */

export const STAKING_PERMS = ["staking.read", "staking.write", "staking.approve", "staking.export"] as const;
export type StakingPerm = (typeof STAKING_PERMS)[number];

const ADMINS = ["platform_owner", "super_admin", "admin"];

export const STAKING_ROLE_MAP: Record<StakingPerm, readonly string[]> = {
  "staking.read": [...ADMINS, "finance", "risk_manager", "compliance"],
  "staking.write": ADMINS,
  "staking.approve": [...ADMINS, "finance"],
  "staking.export": ADMINS,
};

/** Whether a staff member (role + gateway permission list) holds a Staking permission. */
export function stakingAllow(staff: { role: string; permissions?: string[]; rbac?: boolean }, perm: StakingPerm): boolean {
  if (staff.rbac) return staff.permissions?.includes(perm) ?? false;
  const fromGateway = staff.permissions?.some((p) => p.startsWith("staking."));
  if (fromGateway) return staff.permissions!.includes(perm);
  return STAKING_ROLE_MAP[perm].includes(staff.role);
}

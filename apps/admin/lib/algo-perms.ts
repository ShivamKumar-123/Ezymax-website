/**
 * Back Office ALGO permissions (strategies, runtime, webhooks, API keys, marketplace — services/algo).
 *
 * The gateway's role → permission matrix has no algo permissions yet, so the admin BFF owns this map. It mirrors
 * the role checks the algo service enforces itself (services/algo/src/state.rs: STAFF_WRITE_ROLES /
 * STAFF_CONFIG_ROLES); the BFF checks first and the UI hides what the role can't use.
 *
 * When the gateway starts returning algo permissions for a role (any "algo.*" entry in `/v1/admin/auth/me` →
 * permissions), that list wins and this map is no longer consulted.
 *
 * | permission    | what it allows                                                                     | roles                                               |
 * |---------------|------------------------------------------------------------------------------------|-----------------------------------------------------|
 * | algo.read     | overview, strategies, deployments, marketplace, API keys, webhook activity, audit   | every staff role except marketing, partner_manager  |
 * | algo.write    | kill a deployment or a user's automation, moderate listings, revoke API keys       | platform_owner, super_admin, admin, risk_manager,   |
 * |               |                                                                                    | dealer                                              |
 * | algo.settings | platform kill switch, platform cut, rate limits and other ALGO settings            | platform_owner, super_admin, admin                  |
 */

export const ALGO_PERMS = ["algo.read", "algo.write", "algo.settings"] as const;
export type AlgoPerm = (typeof ALGO_PERMS)[number];

const READERS = ["platform_owner", "super_admin", "admin", "dealer", "risk_manager", "compliance", "finance", "support", "viewer"];
const WRITERS = ["platform_owner", "super_admin", "admin", "risk_manager", "dealer"];
const CONFIG = ["platform_owner", "super_admin", "admin"];

export const ALGO_ROLE_MAP: Record<AlgoPerm, readonly string[]> = {
  "algo.read": READERS,
  "algo.write": WRITERS,
  "algo.settings": CONFIG,
};

/** Whether a staff member (role + gateway permission list) holds an algo permission. */
export function algoAllows(staff: { role: string; permissions?: string[] }, perm: AlgoPerm): boolean {
  const fromGateway = staff.permissions?.some((p) => p.startsWith("algo."));
  if (fromGateway) return staff.permissions!.includes(perm);
  return ALGO_ROLE_MAP[perm].includes(staff.role);
}

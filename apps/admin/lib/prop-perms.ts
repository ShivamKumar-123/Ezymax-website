/**
 * Back Office prop firm permissions (plan builder, challenges, funded accounts, payouts, violations,
 * certificates, news calendar).
 *
 * The gateway's role → permission matrix has no prop permissions yet, so the admin BFF owns this map. It
 * mirrors the role checks the prop service enforces itself (services/prop README, "Staff routes"); the BFF
 * checks first so a role never reaches the service for something it may not do, and the UI hides what the role
 * can't use.
 *
 * When the gateway starts returning prop permissions for a role (any "prop.*" entry in `/v1/admin/auth/me` →
 * permissions), that list wins and this map is no longer consulted.
 *
 * | permission   | what it allows                                                                     | roles                                               |
 * |--------------|------------------------------------------------------------------------------------|-----------------------------------------------------|
 * | prop.read    | every prop page (overview, plans, challenges, payouts, violations, certificates…)  | every staff role except marketing, partner_manager  |
 * | prop.write   | plan builder, manual pass / fail, flag review, news calendar, scaling, certificate | platform_owner, super_admin, admin, risk_manager,   |
 * |              | revoke                                                                             | dealer                                              |
 * | prop.approve | payout approve / reject                                                            | platform_owner, super_admin, admin, finance,        |
 * |              |                                                                                    | risk_manager                                        |
 */

export const PROP_PERMS = ["prop.read", "prop.write", "prop.approve"] as const;
export type PropPerm = (typeof PROP_PERMS)[number];

const READERS = ["platform_owner", "super_admin", "admin", "dealer", "risk_manager", "compliance", "finance", "support", "viewer"];
const WRITERS = ["platform_owner", "super_admin", "admin", "risk_manager", "dealer"];
const APPROVERS = ["platform_owner", "super_admin", "admin", "finance", "risk_manager"];

export const PROP_ROLE_MAP: Record<PropPerm, readonly string[]> = {
  "prop.read": READERS,
  "prop.write": WRITERS,
  "prop.approve": APPROVERS,
};

export const isPropPerm = (p: string): p is PropPerm => (PROP_PERMS as readonly string[]).includes(p);

/** Whether a staff member (role + gateway permission list) holds a prop permission. */
export function propAllows(staff: { role: string; permissions?: string[] }, perm: PropPerm): boolean {
  const fromGateway = staff.permissions?.some((p) => p.startsWith("prop."));
  if (fromGateway) return staff.permissions!.includes(perm);
  return PROP_ROLE_MAP[perm].includes(staff.role);
}

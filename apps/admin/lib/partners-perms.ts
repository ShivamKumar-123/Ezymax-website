/**
 * Back Office IB programme permissions (services/ib).
 *
 * The gateway's role → permission matrix (services/gateway/src/admin.rs) has no partner permissions yet, so the
 * admin BFF owns this map, like lib/trading-perms.ts. The IB service checks the same roles again
 * (services/ib/src/api/mod.rs ROLES_WRITE / ROLES_APPROVE); the BFF checks first and the UI hides what a role
 * can't use. When the gateway starts returning any "partners.*" permission for a role, that list wins.
 *
 * | permission        | what it allows                                                                     | roles                                           |
 * |-------------------|------------------------------------------------------------------------------------|-------------------------------------------------|
 * | partners.read     | overview, IB list and detail, network tree, commissions ledger, batches, flags, audit | every staff role except dealer, marketing       |
 * | partners.write    | programme settings, levels and rates, partner level / status / rates, reassignment, | platform_owner, super_admin, admin,             |
 * |                   | fraud-flag decisions, create a payout batch, run jobs                               | partner_manager                                 |
 * | partners.approve  | approve / reject payout batches, retry transfers, reject a commission line          | platform_owner, super_admin, admin, finance     |
 */

export const PARTNER_PERMS = ["partners.read", "partners.write", "partners.approve"] as const;
export type PartnerPerm = (typeof PARTNER_PERMS)[number];

const READERS = ["platform_owner", "super_admin", "admin", "partner_manager", "finance", "compliance", "risk_manager", "support", "viewer"];
const WRITERS = ["platform_owner", "super_admin", "admin", "partner_manager"];
const APPROVERS = ["platform_owner", "super_admin", "admin", "finance"];

export const PARTNER_ROLE_MAP: Record<PartnerPerm, readonly string[]> = {
  "partners.read": READERS,
  "partners.write": WRITERS,
  "partners.approve": APPROVERS,
};

/** Whether a staff member (role + gateway permission list) holds an IB programme permission. */
export function partnersAllow(staff: { role: string; permissions?: string[] }, perm: PartnerPerm): boolean {
  const fromGateway = staff.permissions?.some((p) => p.startsWith("partners."));
  if (fromGateway) return staff.permissions!.includes(perm);
  return PARTNER_ROLE_MAP[perm].includes(staff.role);
}

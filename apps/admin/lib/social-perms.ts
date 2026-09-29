/**
 * Back Office social trading permissions (copy trading, PAMM, fee payouts — "Social & Algo").
 *
 * The gateway's role → permission matrix has no social permissions yet, so the admin BFF owns this map. It
 * mirrors the role checks the trading engine enforces on /v1/social/admin/* (services/trading README,
 * "Back Office routes"); the BFF checks first so a role never reaches the engine for something it may not do,
 * and the UI hides what the role can't use.
 *
 * When the gateway starts returning social permissions for a role (any "social.*" entry in
 * `/v1/admin/auth/me` → permissions), that list wins and this map is no longer consulted.
 *
 * | permission     | what it allows                                                                  | roles                                               |
 * |----------------|---------------------------------------------------------------------------------|-----------------------------------------------------|
 * | social.read    | overview, masters, subscriptions, funds, fees, settings, social audit, profiles | every staff role except marketing, partner_manager  |
 * | social.write   | suspend / reinstate / hide masters, emergency stop, stop a subscription,        | platform_owner, super_admin, admin, risk_manager    |
 * |                | freeze / unfreeze funds, rollovers, snapshots, social settings                  |                                                     |
 * | social.approve | master application review, performance-fee payout review                       | platform_owner, super_admin, admin, compliance      |
 */

export const SOCIAL_PERMS = ["social.read", "social.write", "social.approve"] as const;
export type SocialPerm = (typeof SOCIAL_PERMS)[number];

const READERS = ["platform_owner", "super_admin", "admin", "dealer", "risk_manager", "compliance", "finance", "support", "viewer"];
const WRITERS = ["platform_owner", "super_admin", "admin", "risk_manager"];
const APPROVERS = ["platform_owner", "super_admin", "admin", "compliance"];

export const SOCIAL_ROLE_MAP: Record<SocialPerm, readonly string[]> = {
  "social.read": READERS,
  "social.write": WRITERS,
  "social.approve": APPROVERS,
};

export const isSocialPerm = (p: string): p is SocialPerm => (SOCIAL_PERMS as readonly string[]).includes(p);

/** Whether a staff member (role + gateway permission list) holds a social permission. */
export function socialAllows(staff: { role: string; permissions?: string[]; rbac?: boolean }, perm: SocialPerm): boolean {
  if (staff.rbac) return staff.permissions?.includes(perm) ?? false;
  const fromGateway = staff.permissions?.some((p) => p.startsWith("social."));
  if (fromGateway) return staff.permissions!.includes(perm);
  return SOCIAL_ROLE_MAP[perm].includes(staff.role);
}

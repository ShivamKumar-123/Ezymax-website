/**
 * Back Office support + notifications permissions (services/support).
 *
 * The gateway's RBAC (services/gateway/src/rbac.rs) is the source of truth: the staff member's permission list
 * decides. The role map below is only the fallback for a gateway that returns no permission list. The support
 * service checks the same permissions again: the BFF sends what it resolved in `X-Ezymex-Staff-Perms`.
 *
 * | permission           | what it allows                                                                  | roles                                                        |
 * |----------------------|---------------------------------------------------------------------------------|--------------------------------------------------------------|
 * | support.read         | inbox, conversations, client context panel, KB, canned replies, CSAT / SLA stats | platform_owner, super_admin, admin, support, compliance, finance, risk_manager, viewer |
 * | support.write        | reply, notes, take over, assign, resolve, reopen, tags, edit KB / canned / settings | platform_owner, super_admin, admin, support               |
 * | notifications.write  | compose broadcasts to client segments (in-app / email)                          | platform_owner, super_admin, admin, marketing                |
 */

export const SUPPORT_PERMS = ["support.read", "support.write", "notifications.write"] as const;
export type SupportPerm = (typeof SUPPORT_PERMS)[number];

export const SUPPORT_ROLE_MAP: Record<SupportPerm, readonly string[]> = {
  "support.read": ["platform_owner", "super_admin", "admin", "support", "compliance", "finance", "risk_manager", "viewer"],
  "support.write": ["platform_owner", "super_admin", "admin", "support"],
  "notifications.write": ["platform_owner", "super_admin", "admin", "marketing"],
};

export function supportAllow(staff: { role: string; permissions?: string[]; rbac?: boolean }, perm: SupportPerm): boolean {
  if (staff.rbac) return staff.permissions?.includes(perm) ?? false;
  if (staff.permissions?.length) return staff.permissions.includes(perm);
  return SUPPORT_ROLE_MAP[perm].includes(staff.role);
}

export function supportPerms(staff: { role: string; permissions?: string[] }): SupportPerm[] {
  return SUPPORT_PERMS.filter((p) => supportAllow(staff, p));
}

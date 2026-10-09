/**
 * Back Office reports permissions (Analytics module). The gateway RBAC (services/gateway/src/rbac.rs) is the
 * source of truth: `reports.read` ("View reports") and `reports.export` ("Export reports").
 *
 * | permission     | what it allows                                                                   | preset roles                                   |
 * |----------------|----------------------------------------------------------------------------------|------------------------------------------------|
 * | reports.read   | every Analytics page: broker P&L, revenue, traders, broker risk and scenarios,   | platform_owner, super_admin, admin, finance,   |
 * |                | deposits and FTDs, funnel, cohorts / LTV, accounts and activity, partners,       | risk_manager, compliance, sales,               |
 * |                | scheduled report list                                                            | partner_manager, marketing                     |
 * | reports.export | CSV / Excel downloads, regulatory exports (transactions, client list, deals,     | platform_owner, super_admin, admin, finance    |
 * |                | AML list), any client's statement, creating / editing / running scheduled        |                                                |
 * |                | reports, setting the broker capital (Broker risk; with a reason, audited)        |                                                |
 *
 * What-if scenarios (POST scenarios) also accept the dealing desk's `dealing.read` (lib/trading-perms.ts).
 * The BFF (app/api/reports) checks the permission, then forwards the caller's `reports.*` permissions to the
 * reports service in `X-Ezymex-Staff-Perms`; the service checks them again.
 */

export const REPORTS_PERMS = ["reports.read", "reports.export"] as const;
export type ReportsPerm = (typeof REPORTS_PERMS)[number];

const LEGACY: Record<ReportsPerm, readonly string[]> = {
  "reports.read": ["platform_owner", "super_admin", "admin", "finance", "risk_manager", "compliance", "sales", "partner_manager", "marketing"],
  "reports.export": ["platform_owner", "super_admin", "admin", "finance"],
};

/** Whether a staff member holds a reports permission (gateway list first, role preset as a fallback). */
export function reportsAllows(staff: { role: string; permissions?: string[]; rbac?: boolean }, perm: ReportsPerm): boolean {
  if (staff.rbac || staff.permissions?.some((p) => p.startsWith("reports."))) return staff.permissions?.includes(perm) ?? false;
  return LEGACY[perm].includes(staff.role);
}

export function reportsPermsOf(staff: { role: string; permissions?: string[]; rbac?: boolean }): ReportsPerm[] {
  return REPORTS_PERMS.filter((p) => reportsAllows(staff, p));
}

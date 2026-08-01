/**
 * Client-side route → permission map, mirroring the sidebar's NAV_ITEMS
 * and the backend's require_permission() gates. Used by AdminLayout to
 * bounce users off pages their role can't use — otherwise a deep link
 * (bookmark, typed URL, stale tab after impersonation) renders the page
 * shell and every data fetch fires a raw 403 toast.
 *
 * Backend enforcement is the real security boundary; this is UX.
 */

/** Longest-prefix-first list so /admin-audit-logs wins over /audit-logs etc. */
const PATH_PERMS: [prefix: string, perm: string][] = [
  ['/admin-audit-logs', 'audit_logs.view'],
  ['/account-types', 'config.view'],
  ['/audit-logs', 'audit_logs.view'],
  ['/transactions', 'deposits.view'],
  ['/employees', '_super_admin'],
  ['/analytics', 'analytics.view'],
  ['/settings', '_super_admin'],
  ['/business', 'ib.view'],
  ['/deposits', 'deposits.view'],
  ['/banners', 'banners.view'],
  ['/support', 'tickets.view'],
  ['/social', 'social.view'],
  ['/config', 'config.view'],
  ['/trades', 'trades.view'],
  ['/banks', 'banks.view'],
  ['/bonus', 'bonus.view'],
  ['/users', 'users.view'],
  ['/book', 'trades.view'],
  ['/kyc', 'kyc.view'],
];

/** Permission a path needs, or null for ungated paths (/dashboard, /profile…). */
export function requiredPermForPath(pathname: string): string | null {
  for (const [prefix, perm] of PATH_PERMS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return perm;
  }
  return null;
}

export function hasPerm(
  permissions: string[],
  employeeRole: string,
  perm: string | null,
): boolean {
  if (!perm) return true;
  if (permissions.includes('*')) return true;
  if (perm === '_super_admin') return employeeRole === 'super_admin';
  return permissions.includes(perm);
}

import type { NavModule } from "@kalks/ui";

/**
 * Which permission opens which Back Office page (longest matching prefix wins; any listed key is enough).
 * Keys come from the gateway (services/gateway/src/rbac.rs), which is the single source of truth: the shell hides
 * nav items the staff member can't open, LiveGate shows "No access" for them, and every BFF re-checks the key.
 */
export const PAGE_PERMS: Record<string, readonly string[]> = {
  "/": ["stats.read"],
  "/command": ["stats.read"],
  "/clients": ["clients.read"],
  "/clients/kyc": ["kyc.read"],
  "/trading": ["dealing.read"],
  "/trading/accounts": ["accounts.read"],
  "/config": ["accounts.read", "spreads.read"],
  "/config/spreads": ["spreads.read"],
  "/finance": ["finance.read"],
  "/finance/adjustments": ["finance.adjust", "finance.credit", "finance.adjust_approve", "finance.read"],
  "/partners": ["partners.read"],
  "/social": ["social.read"],
  "/social/marketplace": ["algo.read"],
  "/social/api-keys": ["algo.read"],
  "/prop": ["prop.read"],
  "/algo": ["algo.read"],
  "/marketing": ["marketing.read"],
  "/support": ["support.read"],
  "/content": ["content.read"],
  "/analytics": ["reports.read"],
  "/security": ["audit.read"],
  "/security/users": ["audit.read"],
  "/security/sessions": ["sessions.read"],
  "/security/ip": ["security.read"],
  // /org (own access card) is open to everyone; the staff list itself needs staff.read
  "/org/roles": ["staff.read"],
  "/org/desks": ["staff.read"],
  "/org/kpis": ["staff.read"],
  "/settings": ["settings.read"],
  "/brokers": ["owner.tenants", "owner.system", "owner.billing"],
  "/brokers/billing": ["owner.billing"],
  "/brokers/system": ["owner.system"],
  "/brokers/symbols": ["owner.system"],
};

type Who = { permissions?: string[] };

/** Required permissions for a path (longest prefix), or null when the page is open to every staff member. */
export function pagePerms(pathname: string): readonly string[] | null {
  const key = Object.keys(PAGE_PERMS)
    .filter((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")))
    .sort((a, b) => b.length - a.length)[0];
  return key ? PAGE_PERMS[key]! : null;
}

export function canOpen(staff: Who, pathname: string): boolean {
  const need = pagePerms(pathname);
  return !need || need.some((p) => staff.permissions?.includes(p));
}

/** Navigation without the pages the staff member can't open (a module disappears when none of its pages is left). */
export function navFor(nav: NavModule[], staff: Who): NavModule[] {
  return nav.flatMap((m) => {
    if (!m.sub?.length) return canOpen(staff, m.href) ? [m] : [];
    const sub = m.sub.filter((s) => canOpen(staff, s.href));
    if (!sub.length) return [];
    return [{ ...m, href: sub[0]!.href, sub }];
  });
}

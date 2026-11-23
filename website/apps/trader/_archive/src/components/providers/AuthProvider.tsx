'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePlatformStatusStore } from '@/stores/platformStatusStore';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

const STAFF_ROLES = new Set(['admin', 'super_admin', 'employee', 'manager', 'support']);

/**
 * Public (no-auth) route check — SINGLE source of truth.
 * Previously this expression was duplicated verbatim in the redirect
 * effect and the pre-init render branch, so every new public route had
 * to be added twice (and drift silently broke one path or the other).
 * Keep in sync with PROTECTED_PREFIXES in src/middleware.ts, which
 * enforces the same boundary server-side.
 */
function isPublicPath(pathname: string | null): boolean {
  const p = pathname || '';
  if (p.startsWith('/auth')) return true;
  if (p.startsWith('/s/')) return true;
  if (
    p === '/' ||
    p === '/markets' ||
    p === '/account-types' ||
    p === '/how-it-works' ||
    p.startsWith('/academy') ||
    p.startsWith('/products') ||
    p.startsWith('/services') ||
    p.startsWith('/company') ||
    p.startsWith('/education')
  ) return true;
  if (['/trading/forex', '/trading/commodities', '/trading/indices', '/trading/crypto'].includes(p)) return true;
  if (['/platforms/web', '/platforms/copy-trading', '/platforms/prop-trading', '/platforms/ib-management', '/platforms/super-admin', '/platforms/insurance'].includes(p)) return true;
  if (['/accounts/standard', '/accounts/pro', '/accounts/demo'].includes(p)) return true;
  // Marketing + legal/utility pages. /delete-account in particular MUST stay
  // reachable without a session (Google Play "Account deletion" URL).
  return [
    '/privacy', '/terms', '/risk', '/about', '/contact', '/platforms', '/white-label',
    '/faq', '/download', '/careers',
    '/risk-warning', '/restricted-countries', '/delete-account', '/deposit-withdrawal',
  ].includes(p);
}

function MaintenanceScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#050707',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 24,
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <h1 style={{ color: '#f9fafb', fontSize: 22, fontWeight: 700, margin: 0 }}>
        Platform Under Maintenance
      </h1>
      <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', maxWidth: 360, margin: 0 }}>
        We&apos;re performing scheduled maintenance. Trading and account features are temporarily unavailable. Please check back shortly.
      </p>
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isInitialized, isAuthenticated, user, loadUser, logout } = useAuthStore();
  const maintenance = usePlatformStatusStore((s) => s.maintenance_mode);
  const fetchStatus = usePlatformStatusStore((s) => s.fetch);
  const router = useRouter();
  const pathname = usePathname();
  const hasLoaded = useRef(false);
  const kickedRef = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadUser();
    }
  }, [loadUser]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 20000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  /* Maintenance ON + signed-in non-staff user → force logout once and route to login. */
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    if (!maintenance) {
      kickedRef.current = false;
      return;
    }
    const isStaff = !!user && STAFF_ROLES.has(user.role);
    if (isStaff) return;
    if (kickedRef.current) return;
    kickedRef.current = true;
    logout();
    toast.error('Platform is under maintenance. You have been signed out.', { duration: 6000 });
    router.push('/auth/login');
  }, [maintenance, isAuthenticated, isInitialized, user, logout, router]);

  useEffect(() => {
    if (isInitialized) {
      const isAuthPage = pathname?.startsWith('/auth');
      const isSharePage = pathname?.startsWith('/s/');
      const isPublic = isPublicPath(pathname);

      if (!isAuthenticated && !isAuthPage && !isPublic) {
        router.push('/auth/login');
      } else if (isAuthenticated && (isAuthPage || pathname === '/')) {
        // Do not redirect authenticated users away from public share pages —
        // the short link should open the same card regardless of auth state.
        if (!isSharePage) router.push('/dashboard');
      }
    }
  }, [isInitialized, isAuthenticated, pathname, router]);

  /* Skip loading screen for landing & auth pages — render immediately */
  if (!isInitialized) {
    const isPublicPage = isPublicPath(pathname);

    /* Already know maintenance is ON from persisted store → block immediately */
    if (!isPublicPage && maintenance) return <MaintenanceScreen />;

    if (isPublicPage) return <>{children}</>;

    return null;
  }

  /* Maintenance ON + authenticated non-staff → block entire page with overlay */
  const isStaff = !!user && STAFF_ROLES.has(user.role);
  if (maintenance && !isStaff) {
    return <MaintenanceScreen />;
  }

  return <>{children}</>;
}

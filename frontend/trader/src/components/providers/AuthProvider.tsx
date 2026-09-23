'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePlatformStatusStore } from '@/stores/platformStatusStore';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

const STAFF_ROLES = new Set(['admin', 'super_admin', 'employee', 'manager', 'support']);

/** Single source of truth for "this URL renders without auth".
 *  H-FE-2/H-FE-3: the public set is derived from the (landing) route group —
 *  every route under src/app/(landing)/* is public marketing/legal content, so
 *  we allow-list by TOP-LEVEL SEGMENT. This list mirrors the (landing)/*
 *  directories; keep the two in sync when adding a marketing page. Previously a
 *  hand-kept exact-path set silently missed new pages (/faq, /markets,
 *  /download, /services/*, /products/*, /academy/*, …), bouncing anonymous
 *  visitors off legitimate public pages. */
const PUBLIC_LANDING_SEGMENTS = new Set<string>([
  'about', 'academy', 'account-types', 'accounts', 'careers', 'company',
  'collaboration', 'contact', 'delete-account', 'deposit-withdrawal',
  'download', 'education', 'faq', 'group', 'how-it-works', 'institutional',
  'introducing-brokers', 'markets', 'money-managers', 'partners', 'platforms',
  'policy', 'privacy', 'products', 'protocol', 'restricted-countries', 'risk',
  'risk-warning', 'services', 'terms', 'trading', 'white-label',
]);

function _firstSegment(pathname: string): string {
  return pathname.split('/')[1] || '';
}

function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (pathname.startsWith('/auth')) return true;
  if (pathname.startsWith('/s/')) return true;       // public share-trade short links
  // Chrome-free chart embed for the mobile app's WebView. It authenticates via
  // the token in the URL (the WebView has NO session cookie), so the cookie-
  // based AuthProvider must NEVER treat it as "logged out" and bounce it.
  if (pathname.startsWith('/chart')) return true;
  if (pathname.startsWith('/app-chart')) return true; // APK's dedicated chart
  // The app's own /accounts management page is private; its marketing children
  // (/accounts/demo|pro|standard) stay public via the segment set below.
  if (pathname === '/accounts' || pathname.startsWith('/accounts/')) {
    return pathname.startsWith('/accounts/demo')
      || pathname.startsWith('/accounts/pro')
      || pathname.startsWith('/accounts/standard');
  }
  if (pathname === '/trading' || pathname.startsWith('/trading/')) {
    return !pathname.startsWith('/trading/terminal');
  }
  return PUBLIC_LANDING_SEGMENTS.has(_firstSegment(pathname));
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

  /* Presence heartbeat: while a user is signed in, ping /auth/me every 60s
   * so the gateway refreshes the `presence:user:<id>` Redis key (5-min TTL).
   * Without this, idle traders on a page that doesn't auto-poll would drop
   * out of the admin's online list within minutes. The hit is cheap — same
   * endpoint already used at boot, no payload changes — and it doubles as
   * a session-validity check (a 401 will route us through logout). Pause
   * the interval when the tab is hidden to avoid wasting requests. */
  useEffect(() => {
    if (!isAuthenticated) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const ping = () => { void loadUser(); };
    const start = () => {
      if (timer) return;
      timer = setInterval(ping, 60_000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ping();          // refresh immediately when user returns
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, loadUser]);

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
    if (!isInitialized) return;
    const isAuthPage = pathname?.startsWith('/auth');
    const isSharePage = pathname?.startsWith('/s/');
    const isPublic = isPublicPath(pathname);

    if (!isAuthenticated && !isAuthPage && !isPublic) {
      router.push('/auth/login');
    } else if (isAuthenticated && (isAuthPage || pathname === '/')) {
      // Don't redirect authenticated users away from public share pages —
      // the short link should open the same card regardless of auth state.
      if (!isSharePage) router.push('/dashboard');
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

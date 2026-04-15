'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRouter, usePathname } from 'next/navigation';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isInitialized, isAuthenticated, loadUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadUser();
    }
  }, [loadUser]);

  useEffect(() => {
    if (isInitialized) {
      const isAuthPage = pathname?.startsWith('/auth');
      const isLandingPage =
        pathname === '/' ||
        pathname?.startsWith('/company') ||
        pathname?.startsWith('/education') ||
        ['/trading/forex', '/trading/commodities', '/trading/indices', '/trading/crypto'].includes(pathname || '') ||
        ['/platforms/web', '/platforms/copy-trading', '/platforms/prop-trading', '/platforms/ib-management', '/platforms/super-admin'].includes(pathname || '') ||
        ['/accounts/standard', '/accounts/pro', '/accounts/demo'].includes(pathname || '');
      const isPublic = isLandingPage || pathname === '/privacy' || pathname === '/terms' || pathname === '/risk' || pathname === '/about' || pathname === '/contact' || pathname === '/platforms' || pathname === '/white-label';

      if (!isAuthenticated && !isAuthPage && !isPublic) {
        router.push('/auth/login');
      } else if (isAuthenticated && (isAuthPage || pathname === '/')) {
        router.push('/accounts');
      }
    }
  }, [isInitialized, isAuthenticated, pathname, router]);

  /* Skip loading screen for landing & auth pages — render immediately */
  if (!isInitialized) {
    const isAuthPage = pathname?.startsWith('/auth');
    const isLanding =
      pathname === '/' ||
      pathname?.startsWith('/company') ||
      pathname?.startsWith('/education') ||
      ['/trading/forex', '/trading/commodities', '/trading/indices', '/trading/crypto'].includes(pathname || '') ||
      ['/platforms/web', '/platforms/copy-trading', '/platforms/prop-trading', '/platforms/ib-management', '/platforms/super-admin'].includes(pathname || '') ||
      ['/accounts/standard', '/accounts/pro', '/accounts/demo'].includes(pathname || '');
    const isPublicPage = isLanding || isAuthPage || pathname === '/privacy' || pathname === '/terms' || pathname === '/risk' || pathname === '/about' || pathname === '/contact' || pathname === '/platforms' || pathname === '/white-label';

    if (isPublicPage) return <>{children}</>;

    return null;
  }

  return <>{children}</>;
}

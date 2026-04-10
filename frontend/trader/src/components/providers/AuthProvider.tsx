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
      const isPublic = pathname === '/' || pathname === '/privacy' || pathname === '/terms' || pathname === '/risk' || pathname === '/about' || pathname === '/contact' || pathname === '/platforms' || pathname === '/white-label';

      if (!isAuthenticated && !isAuthPage && !isPublic) {
        router.push('/auth/login');
      } else if (isAuthenticated && (isAuthPage || pathname === '/')) {
        router.push('/accounts');
      }
    }
  }, [isInitialized, isAuthenticated, pathname, router]);

  if (!isInitialized) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="flex flex-col items-center gap-6 animate-[fadeIn_0.3s_ease-out]">
          {/* TrustEdge Logo */}
          <div className="flex items-center gap-3">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="48" height="48" rx="12" fill="#2962FF" />
              <path d="M10 32L18 24L24 30L38 16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M32 16H38V22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-2xl font-bold italic tracking-tight select-none">
              <span style={{ color: '#fff' }}>Trust</span>
              <span style={{ color: '#00e676' }}>Edge</span>
            </span>
          </div>

          {/* Loading bar */}
          <div className="w-48 h-[3px] rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
            <div
              className="h-full rounded-full animate-[loadBar_1s_ease-in-out_infinite]"
              style={{ background: 'linear-gradient(90deg, #2962FF, #00e676)', width: '40%' }}
            />
          </div>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes loadBar { 0% { transform: translateX(-120%); } 100% { transform: translateX(350%); } }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
}

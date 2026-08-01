'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminNotificationBell from '@/components/AdminNotificationBell';
import { useAuthStore } from '@/stores/authStore';
import { adminApi } from '@/lib/api';
import { requiredPermForPath, hasPerm } from '@/lib/permissions';
import { Search, User, LogOut, Loader2, Menu, ShieldOff } from 'lucide-react';
import { useAuthRehydrated } from '@/hooks/useAuthRehydrated';

type Gate = 'boot' | 'ready' | 'redirect';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const admin = useAuthStore((s) => s.admin);
  const authRehydrated = useAuthRehydrated();
  const [mounted, setMounted] = useState(false);
  const [gate, setGate] = useState<Gate>('boot');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // null = permissions not loaded yet
  const [perms, setPerms] = useState<{ permissions: string[]; employeeRole: string } | null>(null);
  const runId = useRef(0);

  // Load the signed-in admin's effective permissions once per mount.
  // Used to route-guard pages the sidebar hides — a deep link (typed
  // URL, bookmark, stale tab after impersonation) would otherwise
  // render the page and every fetch on it would 403-toast.
  useEffect(() => {
    if (gate !== 'ready') return;
    let cancelled = false;
    (async () => {
      try {
        const me = await adminApi.get<{ permissions: string[]; employee_role: string }>('/auth/me');
        if (!cancelled) {
          setPerms({ permissions: me.permissions || [], employeeRole: me.employee_role || '' });
        }
      } catch {
        // Leave perms null — ungated pages still render; gated pages keep the spinner.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gate]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !authRehydrated) {
      setGate('boot');
      return;
    }

    const id = ++runId.current;

    const finish = (next: Gate) => {
      if (runId.current !== id) return;
      setGate(next);
    };

    const run = async () => {
      const { refreshAdminProfile } = useAuthStore.getState();

      // Cookie-based session — we don't know if it's valid until we
      // actually call /auth/me. If admin is already cached from a
      // previous render, render immediately; otherwise probe.
      if (useAuthStore.getState().admin) {
        finish('ready');
        return;
      }

      const ok = await Promise.race([
        refreshAdminProfile(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 15000)),
      ]);

      if (runId.current !== id) return;

      if (!ok) {
        finish('redirect');
        router.replace('/login');
        return;
      }
      finish('ready');
    };

    void run();

    return () => {
      runId.current += 1;
    };
  }, [mounted, authRehydrated, admin, router]);

  if (!mounted || !authRehydrated || gate !== 'ready') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-primary">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-page">
      <AdminSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar — glass effect */}
        <div className="flex items-center h-14 px-3 md:px-5 gap-2 md:gap-3 glass border-b border-border-primary/30">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-1.5 -ml-1 text-text-secondary hover:text-accent transition-fast rounded-md hover:bg-accent/10"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="relative flex-1 max-w-md min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search users, trades..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-bg-primary/60 border border-border-primary/50 rounded-lg backdrop-blur-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <AdminNotificationBell />
            <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg bg-bg-primary/40 border border-border-primary/30">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent/60 to-accent/20 flex items-center justify-center shrink-0">
                <User size={12} className="text-white" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-semibold text-text-primary leading-tight">{admin?.full_name || 'Admin'}</span>
                {/* Employees authenticate as role="admin" users; show their
                    actual employee role (support/finance/…) instead. */}
                <span className="text-[9px] text-accent font-medium leading-tight">
                  {perms?.employeeRole || admin?.role || 'admin'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => useAuthStore.getState().logout()}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-text-tertiary hover:text-sell transition-fast rounded-lg hover:bg-sell/10"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
        {/* Content area with page animation. Route-guard: pages whose
            permission the user lacks show an access notice instead of
            mounting (mounting would fire 403-toasting data fetches). */}
        <div className="flex-1 min-w-0 overflow-auto animate-page-in">
          {(() => {
            const needed = requiredPermForPath(pathname || '');
            if (!needed) return children;
            if (perms === null) {
              return (
                <div className="flex items-center justify-center py-24">
                  <Loader2 size={20} className="animate-spin text-text-tertiary" />
                </div>
              );
            }
            if (hasPerm(perms.permissions, perms.employeeRole, needed)) return children;
            return (
              <div className="flex flex-col items-center justify-center py-24 gap-3 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
                  <ShieldOff size={22} className="text-danger" />
                </div>
                <h2 className="text-sm font-semibold text-text-primary">You don&apos;t have access to this section</h2>
                <p className="text-xs text-text-tertiary max-w-sm">
                  Your role doesn&apos;t include this permission. Ask a super admin if you need it.
                </p>
                <button
                  type="button"
                  onClick={() => router.replace('/dashboard')}
                  className="mt-2 px-4 py-2 rounded-md text-xs font-medium bg-accent text-white hover:opacity-90 transition-fast"
                >
                  Go to Dashboard
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

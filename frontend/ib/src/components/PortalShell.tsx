'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import { ibName, clearSession } from '@/lib/api';

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const name = ibName();
  const initials = (name || 'IB').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  const logout = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <div className="min-h-[100dvh] bg-bg-base text-text-primary lg:grid lg:grid-cols-[240px_1fr]">
      {/* Sidebar — fixed on desktop, off-canvas drawer on mobile */}
      <aside className="hidden border-r border-border-primary bg-bg-base/60 lg:block">
        <div className="sticky top-0 h-[100dvh] overflow-y-auto">
          <Sidebar />
        </div>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full w-64 border-r border-border-primary bg-bg-base">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-text-secondary hover:bg-bg-hover"
            >
              <X size={16} />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border-primary bg-bg-base/85 px-4 py-3 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border-primary text-text-secondary hover:bg-bg-hover lg:hidden"
          >
            <Menu size={16} />
          </button>
          <div className="flex flex-1 items-center justify-end gap-3">
            {name && (
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-full border border-accent/40 bg-accent/10 text-[11px] font-bold text-accent">
                  {initials}
                </div>
                <span className="hidden max-w-[160px] truncate text-sm font-semibold text-text-primary md:inline">{name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <LogOut size={14} /> <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

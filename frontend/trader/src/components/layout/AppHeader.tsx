'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useShellStore } from '@/stores/shellStore';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from '@/components/NotificationListener';
import api from '@/lib/api/client';
import { Menu, ChevronDown, Wallet } from 'lucide-react';

function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function AppHeader() {
  const { toggleSidebar } = useShellStore();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handle = user?.email ? user.email.split('@')[0] : 'Trader';
  const initials = user
    ? (
        user.first_name?.[0] && user.last_name?.[0]
          ? `${user.first_name[0]}${user.last_name[0]}`
          : user.first_name?.[0] || user.email?.[0] || 'U'
      ).toUpperCase()
    : 'U';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.get<{ main_wallet_balance?: number; balance?: number }>('/wallet/summary');
        if (cancelled) return;
        const v = Number(s.main_wallet_balance ?? s.balance ?? 0);
        setBalance(Number.isFinite(v) ? v : 0);
      } catch {
        if (!cancelled) setBalance(0);
      }
    })();
    const t = setInterval(() => {
      void (async () => {
        try {
          const s = await api.get<{ main_wallet_balance?: number; balance?: number }>('/wallet/summary');
          const v = Number(s.main_wallet_balance ?? s.balance ?? 0);
          setBalance(Number.isFinite(v) ? v : 0);
        } catch { /* ignore */ }
      })();
    }, 45_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    if (userMenuOpen) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userMenuOpen]);

  return (
    /* Outer wrapper — sits on #050707 page bg */
    <div className="px-3 pt-3 pb-0 shrink-0">
      <header
        className="h-[65px] flex items-center justify-between px-5 rounded-xl bg-[#0b0f0f]"
        style={{
          border: '1px solid rgba(0,255,150,0.18)',
          boxShadow: '0 0 20px rgba(0,255,150,0.07), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* LEFT — hamburger circle */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="w-10 h-10 rounded-full bg-[#00e676] flex items-center justify-center shrink-0 hover:bg-[#00c853] transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={18} className="text-black" strokeWidth={2.5} />
        </button>

        {/* RIGHT — balance + bell + user */}
        <div className="flex items-center gap-3">
          {/* Balance pill */}
          <Link
            href="/wallet"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#00e676]/30 bg-[#00e676]/5 hover:bg-[#00e676]/10 transition-colors"
          >
            <Wallet size={14} className="text-[#00e676]" />
            <span className="text-[#00e676] text-sm font-medium">{formatUsd(balance)}</span>
            <ChevronDown size={12} className="text-[#00e676]/60" />
          </Link>

          {/* Notification bell */}
          <NotificationBell />

          {/* User avatar + menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-[#00e676]/20 border border-[#00e676]/30 flex items-center justify-center text-[#00e676] text-xs font-bold uppercase">
                {initials}
              </div>
              <span className="text-sm text-white hidden sm:inline">@{handle}</span>
              <ChevronDown size={13} className="text-[#888] hidden sm:inline" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#111] border border-[#2a2a2a] rounded-xl py-1 z-50 shadow-lg">
                  <Link
                    href="/profile"
                    className="block w-full text-left px-4 py-2 text-sm text-[#888] hover:text-white hover:bg-white/5 transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Profile & Settings
                  </Link>
                  <Link
                    href="/wallet"
                    className="block w-full text-left px-4 py-2 text-sm text-[#888] hover:text-white hover:bg-white/5 transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Wallet
                  </Link>
                  <Link
                    href="/kyc"
                    className="block w-full text-left px-4 py-2 text-sm text-[#888] hover:text-white hover:bg-white/5 transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    KYC Verification
                  </Link>
                  <div className="border-t border-[#2a2a2a] my-1" />
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                      router.push('/auth/login');
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}

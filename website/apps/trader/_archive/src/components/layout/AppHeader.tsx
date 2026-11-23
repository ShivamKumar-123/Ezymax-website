'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useShellStore } from '@/stores/shellStore';
import { useAuthStore } from '@/stores/authStore';
import { useTradingStore } from '@/stores/tradingStore';
import { NotificationBell } from '@/components/NotificationListener';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BrandWordmark } from '@/components/layout/BrandWordmark';
import api from '@/lib/api/client';
import { ChevronDown, Wallet, Gift, Users, Menu, X } from 'lucide-react';

function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function AppHeader() {
  const { topMenuOpen, toggleTopMenu } = useShellStore();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Anonymise the header label / initials when the active account is a
  // demo (practice / virtual funds). The user record may carry their real
  // KYC name, but on a demo account we surface a generic "Demo Account"
  // identity so screen-shares / screenshots from practice sessions don't
  // leak personal info. Live-account selection restores the real name.
  const isDemo = !!useTradingStore((s) => s.activeAccount?.is_demo);
  const handle = isDemo
    ? 'Demo Account'
    : (user?.first_name
        ? [user.first_name, user.last_name].filter(Boolean).join(' ')
        : user?.email ? user.email.split('@')[0] : 'Trader');
  const initials = isDemo
    ? 'DA'
    : (user
        ? (
            user.first_name?.[0] && user.last_name?.[0]
              ? `${user.first_name[0]}${user.last_name[0]}`
              : user.first_name?.[0] || user.email?.[0] || 'U'
          ).toUpperCase()
        : 'U');

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
    <div className="px-2 sm:px-3 pt-2 sm:pt-3 pb-0 shrink-0">
      <header
        className="h-[56px] sm:h-[65px] flex items-center justify-between px-3 sm:px-5 rounded-xl bg-bg-secondary border border-border-primary"
      >
        {/* LEFT — hamburger opens the slide-down menu panel (TopNavMenu),
            plus the brand mark. The mark used to live at the top of the
            left sidebar; with that removed, the header is now the only
            place it appears. */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={toggleTopMenu}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label={topMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={topMenuOpen}
          >
            {topMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <BrandWordmark
            href="/dashboard"
            className="hidden sm:flex items-center min-w-0"
            textClassName="text-base"
          />
        </div>

        {/* RIGHT — Bonus/Referral chips + balance + bell + user */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Bonus chip — anchors into /wallet#bonus where the trader sees
              any bonus credit on their account and its history. This is the
              wallet ledger, not a promotion: the first-deposit bonus offer
              and its /bonus marketing page were both withdrawn. */}
          <Link
            href="/wallet#bonus"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#E12019]/25 bg-[#E12019]/5 hover:bg-[#E12019]/10 transition-colors"
            title="View active bonus offers + your bonus history"
          >
            <Gift size={13} className="text-[#E12019] shrink-0" />
            <span className="text-[11px] font-medium text-text-primary">Bonus</span>
          </Link>
          {/* Affiliates chip — quick link to the IB / partner dashboard */}
          <Link
            href="/business"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#E12019]/25 bg-[#E12019]/5 hover:bg-[#E12019]/10 transition-colors"
            title="IB Program — invite traders and earn"
          >
            <Users size={13} className="text-[#E12019] shrink-0" />
            <span className="text-[11px] font-medium text-text-primary">Affiliates</span>
          </Link>

          {/* Balance pill */}
          <Link
            href="/wallet"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-[#E12019]/30 bg-[#E12019]/5 hover:bg-[#E12019]/10 transition-colors"
          >
            <Wallet size={14} className="text-[#E12019] shrink-0" />
            <span className="text-[#E12019] text-xs sm:text-sm font-medium truncate max-w-[90px] sm:max-w-none">{formatUsd(balance)}</span>
            <ChevronDown size={12} className="text-[#E12019]/60 shrink-0 hidden sm:block" />
          </Link>

          {/* Light / vantablack theme switch. Lives in the header because
              it is the only persistent chrome left after the sidebar was
              removed. */}
          <ThemeToggle compact />

          {/* Notification bell */}
          <NotificationBell />

          {/* User avatar + menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#E12019]/20 border border-[#E12019]/30 flex items-center justify-center text-[#E12019] text-[10px] sm:text-xs font-bold uppercase">
                {initials}
              </div>
              <span className="text-sm text-text-primary hidden sm:inline">{handle}</span>
              <ChevronDown size={13} className="text-text-tertiary hidden sm:inline" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-bg-primary border border-border-primary rounded-xl py-1 z-50 shadow-lg">
                  <Link
                    href="/profile"
                    className="block w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Profile & Settings
                  </Link>
                  <Link
                    href="/wallet"
                    className="block w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Wallet
                  </Link>
                  <Link
                    href="/kyc"
                    className="block w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    KYC Verification
                  </Link>
                  <div className="border-t border-border-primary my-1" />
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

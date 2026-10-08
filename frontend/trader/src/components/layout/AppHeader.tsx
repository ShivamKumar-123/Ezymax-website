'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useShellStore } from '@/stores/shellStore';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from '@/components/NotificationListener';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import api from '@/lib/api/client';
import AppTopNav from './AppTopNav';
import { ChevronDown, Menu, Sparkles, Wallet } from 'lucide-react';

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

  const handle = user?.first_name
    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
    : user?.email ? user.email.split('@')[0] : 'Trader';
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
    /* Outer wrapper — sits on #060606 page bg */
    <div className="px-2 sm:px-3 pt-2 sm:pt-3 pb-0 shrink-0">
      <header
        className="relative h-[56px] sm:h-[65px] flex items-center justify-between gap-2 px-3 sm:px-5 rounded-2xl bg-bg-secondary border border-border-primary shadow-[0_6px_24px_-16px_rgba(0,0,0,0.55)]"
      >
        {/* Lime hairline along the top edge — the same accent the sidebar and
            the More menu use, so the chrome reads as one system. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-[#FF6A00]/40 to-transparent"
        />
        {/* LEFT — brand lockup. The wordmark is the brand here: the old
            asset carried its own emblem, so the name used to be set as text
            beside it to avoid showing the mark twice. The current lockup is
            letters only, so the image can carry it. */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={toggleSidebar}
            title="Menu"
            className="group grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#FF6A00]/25 bg-[#FF6A00]/[0.06] transition-all hover:border-[#FF6A00]/50 hover:bg-[#FF6A00]/10 hover:shadow-[0_0_18px_-6px_rgba(255,106,0,0.9)] active:scale-95"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5 text-[#FF6A00] transition-transform duration-200 group-hover:scale-110" />
          </button>
          <Link
            href="/dashboard"
            aria-label="Ezymex — dashboard"
            className="inline-flex select-none items-center transition-opacity hover:opacity-80"
          >
            <img
              src="/images/ezymex-logo.png"
              alt="Ezymex"
              className="brand-logo h-7 w-auto object-contain"
            />
          </Link>
          {/* Hairline separates the brand from the nav capsule */}
          <span aria-hidden className="hidden h-6 w-px bg-border-primary lg:block" />
        </div>

        {/* CENTER — full categorised nav, inline on the same line (lg+) */}
        <AppTopNav />

        {/* RIGHT — outline pill, solid CTA, circular icon buttons, avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Rewards — outline pill. Label appears once there's room. */}
          <Link
            href="/earn/tasks"
            title="XP & rewards"
            aria-label="XP and rewards"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border-primary bg-bg-base px-2.5 lg:px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-[#FF6A00]/40 hover:text-text-primary"
          >
            <Sparkles size={15} className="shrink-0 text-[#FF6A00]" />
            <span className="hidden xl:inline">Rewards</span>
          </Link>

          {/* Deposit — the one solid brand CTA in the header. Balance stays in
              the tooltip so the pill keeps a fixed width. */}
          <Link
            href="/wallet"
            title={`Balance: ${formatUsd(balance)}`}
            aria-label={`Deposit — balance ${formatUsd(balance)}`}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#FF6A00] px-2.5 sm:px-3.5 text-[13px] font-bold text-[#060606] shadow-[0_2px_12px_-3px_rgba(255,106,0,0.75)] transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Wallet size={15} className="shrink-0" />
            <span className="hidden sm:inline">Deposit</span>
          </Link>

          {/* Theme toggle — bordered circle so it matches the bell beside it
              (the plain compact variant was 32px and ring-less). */}
          <ThemeToggle className="border border-border-primary bg-bg-base" />

          {/* Notification bell */}
          <NotificationBell />

          {/* User avatar + menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label="Account menu"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              {/* Solid avatar, dark initials — the tinted version went pale on
                  the light theme. */}
              <div
                title={handle}
                className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full bg-[#FF6A00] flex items-center justify-center text-[#060606] text-[10px] sm:text-xs font-bold uppercase"
              >
                {initials}
              </div>
              <ChevronDown
                size={14}
                className={`shrink-0 text-text-tertiary transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
              />
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

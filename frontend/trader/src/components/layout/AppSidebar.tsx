'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useShellStore } from '@/stores/shellStore';
import { TrustEdgeWordmark } from '@/components/layout/TrustEdgeWordmark';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Wallet,
  History,
  TrendingUp,
  Copy,
  Users,
  GraduationCap,
  Newspaper,
  ShieldCheck,
  Settings,
  X,
  FileText,
  Globe,
  ChevronDown,
  HelpCircle,
  Headphones,
  Receipt,
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'Accounts', href: '/accounts', icon: LayoutGrid },
  { label: 'Deposit/Withdraw', href: '/wallet', icon: Wallet },
  { label: 'Transactions', href: '/transactions', icon: History },
  { label: 'Portfolio', href: '/portfolio', icon: Receipt },
  { label: 'PAMM', href: '/pamm', icon: TrendingUp },
  { label: 'Copy Trading', href: '/social', icon: Copy },
  { label: 'Affiliates', href: '/business', icon: Users },
  { label: 'TrustEdge Academy', href: '/academy', icon: GraduationCap },
  { label: 'Economic News', href: '/news', icon: Newspaper },
  { label: 'KYC', href: '/kyc', icon: ShieldCheck },
  { label: 'Settings', href: '/profile', icon: Settings },
] as const;

const LANGUAGES = ['English', 'Español', 'Français', 'Deutsch', 'Português'];

export default function AppSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useShellStore();
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English');

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-bg-base/75 z-[65] lg:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          /* z-[70] above MobileBottomNav (z-[60]) so drawer links receive taps on small screens */
          'fixed top-0 left-0 z-[70] h-full w-[260px] flex flex-col overflow-hidden transition-transform duration-200',
          'bg-bg-base border-r border-border-primary',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-2">
          <TrustEdgeWordmark
            href="/dashboard"
            className="flex items-center min-w-0"
            textClassName="text-xl"
          />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 px-2 sidebar-scroll">
          {NAV_ITEMS.map((item) => {
            const itemPath = item.href.split('?')[0];
            const isActive = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors mb-0.5',
                  isActive
                    ? 'bg-accent/10 text-text-primary border border-accent/22'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
                )}
              >
                <item.icon
                  size={17}
                  strokeWidth={1.85}
                  className={cn(
                    'shrink-0 transition-[filter,color]',
                    isActive
                      ? 'text-accent drop-shadow-[0_0_8px_rgba(0,230,118,0.45)]'
                      : 'text-accent/55 drop-shadow-[0_0_4px_rgba(0,230,118,0.12)]',
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 pt-2 space-y-2.5 border-t border-border-primary bg-bg-base">
          <Link
            href="/terms"
            className="flex items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:border-border-accent transition-colors"
          >
            <FileText size={14} className="text-accent shrink-0 opacity-90" />
            <span>Terms & Conditions</span>
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:border-border-accent w-full transition-colors"
            >
              <Globe size={14} className="text-accent shrink-0 opacity-90" />
              <span>{selectedLang}</span>
              <ChevronDown
                size={12}
                className={cn('ml-auto text-text-tertiary transition-transform shrink-0', langOpen && 'rotate-180')}
              />
            </button>
            {langOpen && (
              <div className="absolute bottom-full left-0 mb-1.5 w-full bg-bg-secondary border border-border-primary rounded-lg py-1 z-50 max-h-[200px] overflow-y-auto sidebar-scroll shadow-lg">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setSelectedLang(lang);
                      setLangOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs transition-colors',
                      lang === selectedLang
                        ? 'text-accent bg-accent/8'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-3.5 border border-border-primary bg-card-nested">
            <div className="flex items-center gap-1.5 mb-1">
              <HelpCircle size={14} className="text-accent shrink-0" />
              <span className="text-xs font-semibold text-text-primary">Need Help?</span>
            </div>
            <p className="text-[10px] text-text-tertiary mb-3 leading-relaxed">Contact our 24/7 support team</p>
            <Link
              href="/support"
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-accent/35 hover:bg-accent/5 transition-colors"
            >
              <Headphones size={12} className="text-accent/80" />
              <span>Get Support</span>
            </Link>
          </div>

        </div>
      </aside>
    </>
  );
}

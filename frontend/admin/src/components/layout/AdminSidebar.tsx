'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import {
  LayoutDashboard, Users, CandlestickChart, Wallet, Landmark,
  Settings, Sliders, BarChart3, Gift, Image, HeadphonesIcon,
  UserCog, ChevronDown, ChevronRight, Network, Share2,
  DollarSign, Percent, ArrowLeftRight, PanelLeftClose, PanelLeft,
  Receipt, Layers, ShieldCheck, ScrollText, BookOpen, X,
  Building2, Palette,
} from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  icon: any;
  badge?: number;
  perm?: string;
  children?: { label: string; href: string; perm?: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Users', href: '/users', icon: Users, perm: 'users.view' },
  {
    label: 'Identity verification',
    href: '/kyc',
    icon: ShieldCheck,
    perm: 'kyc.view',
  },
  { label: 'Trades', href: '/trades', icon: CandlestickChart, perm: 'trades.view' },
  { label: 'Book Management', href: '/book', icon: BookOpen, perm: '_platform:trades.view' },
  { label: 'Deposits', href: '/deposits', icon: Wallet, perm: 'deposits.view' },
  { label: 'Transactions', href: '/transactions', icon: Receipt, perm: 'deposits.view' },
  { label: 'Banks', href: '/banks', icon: Landmark, perm: 'banks.view' },
  { label: 'Account types', href: '/account-types', icon: Layers, perm: 'config.view' },
  {
    label: 'Config', icon: Sliders, perm: 'config.view',
    children: [
      { label: 'Overview', href: '/config' },
      { label: 'Charges', href: '/config/charges' },
      { label: 'Spreads', href: '/config/spreads' },
      { label: 'Swaps', href: '/config/swaps' },
    ],
  },
  { label: 'Social', href: '/social', icon: Share2, perm: 'social.view' },
  {
    label: 'Business', icon: Network, perm: 'ib.view',
    children: [
      { label: 'Overview', href: '/business' },
      { label: 'IB Program', href: '/business/ib' },
      { label: 'Sub-Broker', href: '/business/sub-broker' },
      { label: 'Copy Masters', href: '/business/masters' },
      { label: 'MLM Config', href: '/business/mlm' },
    ],
  },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, perm: 'analytics.view' },
  { label: 'Audit logs', href: '/audit-logs', icon: ScrollText, perm: 'audit_logs.view' },
  { label: 'Admin audit logs', href: '/admin-audit-logs', icon: ScrollText, perm: 'audit_logs.view' },
  { label: 'Bonus', href: '/bonus', icon: Gift, perm: 'bonus.view' },
  { label: 'Banners', href: '/banners', icon: Image, perm: 'banners.view' },
  { label: 'Support', href: '/support', icon: HeadphonesIcon, perm: 'tickets.view' },
  { label: 'Brokers', href: '/brokers', icon: Building2, perm: 'sub_brokers.view' },
  { label: 'Branding', href: '/branding', icon: Palette, perm: '_broker' },
  { label: 'Employees', href: '/employees', icon: UserCog, perm: '_super_admin' },
  { label: 'Settings', href: '/settings', icon: Settings, perm: '_super_admin' },
];

export default function AdminSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
} = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Config', 'Business']);
  const [permissions, setPermissions] = useState<string[]>(['*']);
  const [employeeRole, setEmployeeRole] = useState<string>('super_admin');
  // White-label broker logins show THEIR brand in the sidebar header.
  const [brandName, setBrandName] = useState<string>('');
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  // Track viewport so the desktop "collapse" state never hides labels in the
  // mobile drawer (the drawer is always full-width on phones).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // On phones the drawer is always expanded; collapse is a desktop-only affordance.
  const showLabels = !collapsed || isMobile;

  useEffect(() => {
    (async () => {
      try {
        const me = await adminApi.get<{ permissions: string[]; employee_role: string; brand_name?: string | null; logo_url?: string | null; role?: string }>('/auth/me');
        setPermissions(me.permissions || []);
        setEmployeeRole(me.employee_role || '');
        if (me.role === 'broker') {
          const bn = (me.brand_name || '').trim() || 'Broker Panel';
          setBrandName(bn);
          setBrandLogo(me.logo_url || null);
          // Tab identity follows the tenant everywhere in the panel.
          document.title = `${bn} Admin`;
          if (me.logo_url) {
            const icon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
            if (icon) icon.href = me.logo_url;
            const link = document.createElement('link');
            link.rel = 'icon';
            link.href = me.logo_url;
            link.setAttribute('data-wl-icon', '1');
            document.head.appendChild(link);
          }
        }
      } catch {}
    })();
  }, []);

  const hasAccess = (perm?: string) => {
    if (!perm) return true;
    // '_broker' marks broker-only surfaces (own Branding page) — checked
    // before the '*' wildcard so a super admin doesn't see them.
    if (perm === '_broker') return employeeRole === 'broker';
    // '_platform:<perm>' — platform-only surfaces brokers never see,
    // even when they hold the underlying permission (Book Management).
    if (perm.startsWith('_platform:')) {
      if (employeeRole === 'broker') return false;
      const base = perm.slice('_platform:'.length);
      return permissions.includes('*') || permissions.includes(base);
    }
    if (permissions.includes('*')) return true;
    if (perm === '_super_admin') return employeeRole === 'super_admin';
    return permissions.includes(perm);
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const isActive = (href?: string) => href && pathname === href;

  const visibleItems = NAV_ITEMS.filter(item => hasAccess(item.perm));

  return (
    <div className={cn(
      'flex flex-col h-full glass-card border-r border-border-primary/50 transition-all duration-300',
      // Mobile: off-canvas drawer, fixed and slides in/out.
      'fixed inset-y-0 left-0 z-50 w-60 max-w-[82vw] -translate-x-full',
      mobileOpen && 'translate-x-0 shadow-2xl',
      // Desktop (md+): in-flow flex child, collapsible.
      'md:static md:z-auto md:translate-x-0 md:max-w-none md:shadow-none',
      collapsed ? 'md:w-14' : 'md:w-60',
    )}>
      {/* Header */}
      <div className="flex items-center h-14 px-3 border-b border-border-primary/40">
        {brandName ? (
          showLabels ? (
            <Link href="/" className="flex items-center min-w-0 gap-2">
              {brandLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogo} alt={brandName} className="h-7 w-auto max-w-[150px] object-contain shrink-0" />
              ) : (
                <span className="font-bold tracking-tight text-base text-text-primary truncate">{brandName}</span>
              )}
            </Link>
          ) : brandLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogo} alt={brandName} className="w-7 h-7 object-contain rounded-md mx-auto" />
          ) : (
            <span className="font-bold text-base text-text-primary mx-auto select-none">
              {brandName.slice(0, 2).toUpperCase()}
            </span>
          )
        ) : !showLabels ? (
          <img src="/logo.png" alt="SwissCresta" className="w-7 h-7 object-contain mx-auto" />
        ) : (
          <Link href="/" className="flex items-center min-w-0">
            <img src="/swisscresta-logo.png" alt="SwissCresta" className="h-7 w-auto object-contain shrink-0" />
          </Link>
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('hidden md:block p-1.5 text-text-tertiary hover:text-accent transition-fast rounded-md hover:bg-accent/10', !collapsed && 'ml-auto')}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
        {/* Mobile close button */}
        <button
          onClick={() => onClose?.()}
          className="md:hidden ml-auto p-1.5 text-text-tertiary hover:text-accent transition-fast rounded-md hover:bg-accent/10"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleItems.map((item) => {
          if (item.children) {
            const isExpanded = expandedGroups.includes(item.label);
            const hasActiveChild = item.children.some((c) => pathname?.startsWith(c.href));
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-fast rounded-md mx-1',
                    hasActiveChild ? 'text-accent bg-accent/8' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                  )}
                >
                  <item.icon size={16} />
                  {showLabels && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </>
                  )}
                </button>
                {isExpanded && showLabels && (
                  <div className="ml-4 border-l border-border-primary">
                    {item.children.filter(c => hasAccess(c.perm)).map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'block pl-4 pr-3 py-1.5 text-xs transition-fast',
                          isActive(child.href)
                            ? 'text-accent border-l-2 border-accent -ml-px font-semibold'
                            : 'text-text-tertiary hover:text-text-primary hover:text-accent/80',
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href!}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-xs font-medium transition-fast relative rounded-md mx-1',
                isActive(item.href)
                  ? 'nav-active'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
              )}
            >
              <item.icon size={16} />
              {showLabels && (
                <>
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-xxs bg-sell/20 text-sell rounded-sm tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

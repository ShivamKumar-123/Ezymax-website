'use client';

import Link from 'next/link';
import { ArrowUpRight, Compass, Wallet, Users, Calculator } from 'lucide-react';
import { PanelCard } from './PanelCard';

/**
 * Quick links — the reference's compact link-list card, pointing ONLY at
 * existing platform sections (routes already in the app navigation).
 */
const LINKS = [
  { href: '/wallet', label: 'Wallet & transfers', Icon: Wallet },
  { href: '/referral', label: 'Referral program', Icon: Users },
  { href: '/risk-calculator', label: 'Risk calculator', Icon: Calculator },
];

export function QuickLinksCard() {
  return (
    <PanelCard title="Explore" icon={Compass} padding="sm">
      <ul>
        {LINKS.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-bg-hover transition-colors group"
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-secondary)' }}
              >
                <Icon size={15} className="text-text-secondary" />
              </span>
              <span className="text-xs font-semibold text-text-primary flex-1">{label}</span>
              <ArrowUpRight size={14} className="text-text-tertiary group-hover:text-text-primary transition-colors" />
            </Link>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}

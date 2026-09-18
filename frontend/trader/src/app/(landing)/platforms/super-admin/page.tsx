import Link from 'next/link';
import { Users, BarChart2, Settings, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → Super Admin. Restyled onto the shared marketing design
 * system. Card copy carried over from the previous landing component;
 * the per-card actions now point at the sign-in flow (the old buttons
 * had no destination — they opened the global signup popup).
 */

const ADMIN_CARDS = [
  {
    icon: Users,
    title: 'User Management',
    description: 'View, edit, and manage all trader accounts.',
    cta: 'Manage Users',
  },
  {
    icon: BarChart2,
    title: 'Trading Overview',
    description: 'Monitor live trades, volume, and activity.',
    cta: 'View Reports',
  },
  {
    icon: Settings,
    title: 'Platform Settings',
    description: 'Configure platform rules, spreads, and leverage.',
    cta: 'Open Settings',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance & KYC',
    description: 'Review documents, approvals, and flagged accounts.',
    cta: 'Review Cases',
  },
];

export default function SuperAdminPage() {
  return (
    <main>
      <PageHero
        kicker="Super Admin"
        title="Super Admin Panel"
        lead={`Manage and monitor all ${BRAND_NAME} operations from one central dashboard.`}
      />

      <Section raised>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-8"
          style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ADMIN_CARDS.map(({ icon: Icon, title, description, cta }) => (
            <article key={title} className="mk-card mk-card--hover flex flex-col gap-3 items-start">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Icon size={20} />
              </span>
              <h3 className="mk-h3">{title}</h3>
              <p className="mk-body">{description}</p>
              <Link href="/auth/login" className="mk-btn mk-btn--primary mt-2">{cta}</Link>
            </article>
          ))}
        </div>
      </Section>

      <CtaBanner
        title="One Console for the Whole Operation"
        lead={`Sign in to manage and monitor every ${BRAND_NAME} operation from a single dashboard.`}
        primary={{ label: 'Sign In', href: '/auth/login' }}
        secondary={{ label: 'Contact Us', href: '/company/contact' }}
      />
    </main>
  );
}
